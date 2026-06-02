import { NextRequest, NextResponse } from 'next/server'
import { google, docs_v1 } from 'googleapis'

export const maxDuration = 60

// ─── Template & folder ───────────────────────────────────────────────────────
// The blank template with exact formatting to copy for each review
const TEMPLATE_DOC_ID    = '1iEf-HdeKnYUTmHMvRtcQygDEh87dOWycSwQzrfZvC8E'
const PERF_REVIEW_FOLDER = '1vj8HSp0QnBlfwCoLvtzz-z3uJkh_84hg'

// ─── Auth ────────────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const clientId     = (process.env.GOOGLE_CLIENT_ID     ?? '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  const refreshToken = (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? '').trim()

  console.log('[send-to-drive] client_id prefix    :', clientId.slice(0, 20))
  console.log('[send-to-drive] client_secret prefix:', clientSecret.slice(0, 6))
  console.log('[send-to-drive] refresh_token prefix :', refreshToken.slice(0, 10))

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  console.log('[send-to-drive] token response:', JSON.stringify(data))

  if (!res.ok || !data.access_token) {
    throw new Error(
      `[v2] Google token error: ${data.error} — ${data.error_description ?? 'no description'} | ` +
      `client_id[0:20]=${clientId.slice(0,20)} secret[0:6]=${clientSecret.slice(0,6)} token[0:12]=${refreshToken.slice(0,12)}`
    )
  }
  return data.access_token
}

function getAuth(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return auth
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CompetencyEntry { competency: string; examples: [string, string, string] }
interface GoalEntry { text: string; status: string; explanation: string }
interface NextGoal  { text: string; targetDate: string }

// ─── Flatten all text runs from the document (including inside tables) ────────
interface TextRun { text: string; startIndex: number; endIndex: number }

function flattenRuns(content: docs_v1.Schema$StructuralElement[]): TextRun[] {
  const runs: TextRun[] = []
  function walk(els: docs_v1.Schema$StructuralElement[]) {
    for (const el of els) {
      if (el.paragraph?.elements) {
        for (const pe of el.paragraph.elements) {
          if (pe.textRun?.content && pe.startIndex != null && pe.endIndex != null) {
            runs.push({ text: pe.textRun.content, startIndex: pe.startIndex, endIndex: pe.endIndex })
          }
        }
      } else if (el.table?.tableRows) {
        for (const row of el.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) {
            walk(cell.content ?? [])
          }
        }
      }
    }
  }
  walk(content)
  return runs.sort((a, b) => a.startIndex - b.startIndex)
}

// ─── Find Nth occurrence of searchText across all runs ────────────────────────
interface DocRange { startIndex: number; endIndex: number }

function findOccurrences(runs: TextRun[], searchText: string): DocRange[] {
  const results: DocRange[] = []
  for (const run of runs) {
    let pos = 0
    while (true) {
      const idx = run.text.indexOf(searchText, pos)
      if (idx === -1) break
      results.push({ startIndex: run.startIndex + idx, endIndex: run.startIndex + idx + searchText.length })
      pos = idx + searchText.length
    }
  }
  return results.sort((a, b) => a.startIndex - b.startIndex)
}

// ─── Build delete+insert Docs API requests, applied in reverse index order ───
interface ReplaceOp { startIndex: number; endIndex: number; newText: string }

function buildRequests(ops: ReplaceOp[]): docs_v1.Schema$Request[] {
  const sorted = [...ops].sort((a, b) => b.startIndex - a.startIndex) // highest first
  const reqs: docs_v1.Schema$Request[] = []
  for (const op of sorted) {
    if (op.startIndex < op.endIndex) {
      reqs.push({ deleteContentRange: { range: { startIndex: op.startIndex, endIndex: op.endIndex } } })
    }
    if (op.newText) {
      reqs.push({ insertText: { location: { index: op.startIndex }, text: op.newText } })
    }
  }
  return reqs
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form = await req.json() as {
      employeeName: string; employeePosition: string; employeeDivision: string
      supervisorName: string; appraisalPeriod: string; reviewDate: string
      competencyOne: CompetencyEntry; competencyTwo: CompetencyEntry
      competencyThree: CompetencyEntry; competencyFour: CompetencyEntry
      competencyFive: CompetencyEntry; competencyFiveType: 'positive' | 'constructive'
      goals: GoalEntry[]; overallScore: number; overallSummary: string
      nextGoals: NextGoal[]
      driveFolderId?: string
    }

    // Use caller-supplied folder ID if provided, otherwise fall back to default
    const targetFolder = form.driveFolderId?.trim() || PERF_REVIEW_FOLDER

    const accessToken = await getAccessToken()
    const auth  = getAuth(accessToken)
    const drive = google.drive({ version: 'v3', auth })
    const docs  = google.docs({ version: 'v1', auth })

    // ── 1. Copy the template into the Performance Reviews folder ──────────────
    const safeName   = (form.employeeName || 'Employee').replace(/\s+/g, '')
    const safePeriod = (form.appraisalPeriod || 'UnknownPeriod')
      .replace(/\s*[–—]\s*/g, '-').replace(/\s*-\s*/g, '-').trim()
    const docTitle   = `${safeName}_AnnualPerformanceReview_Manager_${safePeriod}`

    const copyRes = await drive.files.copy({
      fileId: TEMPLATE_DOC_ID,
      requestBody: { name: docTitle, parents: [targetFolder] },
    })
    const docId = copyRes.data.id
    if (!docId) throw new Error('Failed to copy template — no doc ID returned.')

    // ── 2. replaceAllText for the one truly unique string ──────────────────────
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          replaceAllText: {
            containsText: { text: 'positive or constructive', matchCase: true },
            replaceText: form.competencyFiveType === 'positive' ? 'positive' : 'constructive',
          },
        }],
      },
    })

    // ── 3. Read document for all position-based replacements ──────────────────
    const docRes = await docs.documents.get({ documentId: docId })
    const runs   = flattenRuns(docRes.data.body?.content ?? [])
    const ops: ReplaceOp[] = []

    const SCORE_LABELS: Record<number, string> = {
      1: 'Unsatisfactory', 2: 'Needs Improvement', 3: 'Meets Expectations',
      4: 'Exceeds Job Requirements', 5: 'Outstanding',
    }

    // Helper: insert text into the empty \n cell immediately after a label
    function insertAfterLabel(label: string, newText: string) {
      if (!newText) return
      const occ = findOccurrences(runs, label)
      if (!occ.length) return
      const after = occ[0].endIndex
      const slot = runs.find(r => r.startIndex >= after && r.text === '\n')
      if (slot) ops.push({ startIndex: slot.startIndex, endIndex: slot.startIndex, newText })
    }

    // Helper: replace a dropdown chip (empty-string run) or empty cell after a label
    function replaceChipOrEmptyAfterLabel(label: string, newText: string) {
      if (!newText) return
      const occ = findOccurrences(runs, label)
      if (!occ.length) return
      const after = occ[0].endIndex
      // Dropdown chips appear as empty-string runs; empty cells appear as '\n' runs
      const chip      = runs.find(r => r.startIndex >= after && r.text === '')
      const emptyCell = runs.find(r => r.startIndex >= after && r.text === '\n')
      if (chip && chip.startIndex <= (emptyCell?.startIndex ?? Infinity)) {
        ops.push({ startIndex: chip.startIndex, endIndex: chip.endIndex, newText })
      } else if (emptyCell) {
        ops.push({ startIndex: emptyCell.startIndex, endIndex: emptyCell.startIndex, newText })
      }
    }

    // ── 4a. Header fields ─────────────────────────────────────────────────────
    insertAfterLabel('Employee Name:\n',              form.employeeName)
    replaceChipOrEmptyAfterLabel('Employee Position:\n', form.employeePosition || '')
    replaceChipOrEmptyAfterLabel('Employee Division:\n', form.employeeDivision || '')
    replaceChipOrEmptyAfterLabel('Supervisor Name:\n',   form.supervisorName   || '')

    // ── 4b. Appraisal Period & Review Date ────────────────────────────────────
    insertAfterLabel('Appraisal Period:\n', form.appraisalPeriod)
    insertAfterLabel('Review Date:\n',      form.reviewDate)

    // ── 5. Competency names — insert before the \n at end of each header line ─
    // Template structure: "COMPETENCY ONE (positive): ↵" → insert name before ↵
    const compNames = [
      form.competencyOne.competency,   form.competencyTwo.competency,
      form.competencyThree.competency, form.competencyFour.competency,
      form.competencyFive.competency,
    ]
    const compHeaders = ['COMPETENCY ONE', 'COMPETENCY TWO', 'COMPETENCY THREE', 'COMPETENCY FOUR', 'COMPETENCY FIVE']
    compHeaders.forEach((header, i) => {
      if (!compNames[i]) return
      const headerOcc = findOccurrences(runs, header)
      if (!headerOcc.length) return
      const after = headerOcc[0].endIndex
      // "EXPLANATION:" marks the end of the header area
      const explLabel = findOccurrences(runs, 'EXPLANATION:').find(r => r.startIndex > after)
      const nlRun = runs.find(r =>
        r.startIndex >= after &&
        r.startIndex < (explLabel?.startIndex ?? Infinity) &&
        r.text === '\n'
      )
      if (nlRun) ops.push({ startIndex: nlRun.startIndex, endIndex: nlRun.startIndex, newText: compNames[i] })
    })

    // ── 6. Examples — "[INSERT EXAMPLE]" appears 15 times in order ────────────
    const allExamples = [
      ...form.competencyOne.examples,   ...form.competencyTwo.examples,
      ...form.competencyThree.examples, ...form.competencyFour.examples,
      ...form.competencyFive.examples,
    ]
    findOccurrences(runs, '[INSERT EXAMPLE]').slice(0, 15).forEach((range, i) => {
      ops.push({ ...range, newText: allExamples[i]?.trim() || '' })
    })

    // ── 7. Goals — insert after numbered markers "1.\n" … "5.\n" ─────────────
    // Template: "1.↵" is the goal slot; insert text just before the ↵
    const goalsLabelEnd  = findOccurrences(runs, 'Goals/Objectives/Accomplishments:')[0]?.endIndex ?? 0
    const overallSummaryStart = findOccurrences(runs, 'OVERALL PERFORMANCE EVALUATION SUMMARY:')[0]?.startIndex ?? Infinity

    form.goals.filter(g => g.text.trim()).forEach((goal, i) => {
      const marker = `${i + 1}.\n`
      const markerOcc = findOccurrences(runs, marker)
        .filter(r => r.startIndex > goalsLabelEnd && r.startIndex < overallSummaryStart)
      if (!markerOcc.length) return
      const insertAt = markerOcc[0].endIndex - 1 // just before the trailing \n
      const statusTag  = goal.status ? ` (${goal.status.toUpperCase()})` : ''
      const explanation = goal.explanation.trim() ? `\n${goal.explanation.trim()}` : ''
      ops.push({ startIndex: insertAt, endIndex: insertAt, newText: ` ${goal.text.trim()}${statusTag}${explanation}` })
    })

    // ── 8. Overall score & summary ────────────────────────────────────────────
    if (form.overallScore > 0) {
      const scoreLabelEnd = findOccurrences(runs, 'OVERALL SCORE')[0]?.endIndex ?? 0
      const emptyAfterScore = runs.filter(r => r.startIndex > scoreLabelEnd && /^\s*\n$/.test(r.text))
      if (emptyAfterScore[0]) {
        ops.push({
          startIndex: emptyAfterScore[0].startIndex,
          endIndex:   emptyAfterScore[0].startIndex,
          newText: `${form.overallScore} — ${SCORE_LABELS[form.overallScore] || ''}`,
        })
      }
      if (form.overallSummary.trim() && emptyAfterScore[1]) {
        ops.push({
          startIndex: emptyAfterScore[1].startIndex,
          endIndex:   emptyAfterScore[1].startIndex,
          newText: form.overallSummary.trim(),
        })
      }
    }

    // ── 9. Next Year's Goals — insert in empty \n run AFTER each "1.\n" marker ─
    const ngLabelEnd = findOccurrences(runs, "Next Year's Goals").at(-1)?.endIndex ?? 0
    const sigStart   = findOccurrences(runs, 'Employee Signature')[0]?.startIndex ?? Infinity

    form.nextGoals.filter(g => g.text.trim()).forEach((goal, i) => {
      const marker = `${i + 1}.\n`
      const markerOcc = findOccurrences(runs, marker)
        .filter(r => r.startIndex > ngLabelEnd && r.startIndex < sigStart)
      if (!markerOcc.length) return
      // The empty \n paragraph comes right AFTER the marker
      const afterMarker = markerOcc[0].endIndex
      const slot = runs.find(r => r.startIndex >= afterMarker && r.startIndex < sigStart && r.text === '\n')
      if (!slot) return
      const dateStr = goal.targetDate.trim() ? `\nTarget Date: ${goal.targetDate.trim()}` : ''
      ops.push({ startIndex: slot.startIndex, endIndex: slot.startIndex, newText: `${goal.text.trim()}${dateStr}` })
    })

    // ── 10. Apply all position-based changes ──────────────────────────────────
    if (ops.length > 0) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests: buildRequests(ops) },
      })
    }

    return NextResponse.json({
      docId,
      docUrl:   `https://docs.google.com/document/d/${docId}/edit`,
      docTitle,
    })
  } catch (err) {
    console.error('[send-to-drive]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
