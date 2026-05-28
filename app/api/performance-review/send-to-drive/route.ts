import { NextRequest, NextResponse } from 'next/server'
import { google, docs_v1 } from 'googleapis'

export const maxDuration = 60

// ─── Template & folder ───────────────────────────────────────────────────────
// The blank template with exact formatting to copy for each review
const TEMPLATE_DOC_ID    = '1iEf-HdeKnYUTmHMvRtcQygDEh87dOWycSwQzrfZvC8E'
const PERF_REVIEW_FOLDER = '1vj8HSp0QnBlfwCoLvtzz-z3uJkh_84hg'

// ─── Auth ────────────────────────────────────────────────────────────────────
function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN })
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
    }

    const auth  = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const docs  = google.docs({ version: 'v1', auth })

    // ── 1. Copy the template into the Performance Reviews folder ──────────────
    const safeName   = (form.employeeName || 'Employee').replace(/\s+/g, '')
    const safePeriod = (form.appraisalPeriod || 'UnknownPeriod')
      .replace(/\s*[–—]\s*/g, '-').replace(/\s*-\s*/g, '-').trim()
    const docTitle   = `${safeName}_AnnualPerformanceReview_Manager_${safePeriod}`

    const copyRes = await drive.files.copy({
      fileId: TEMPLATE_DOC_ID,
      requestBody: { name: docTitle, parents: [PERF_REVIEW_FOLDER] },
    })
    const docId = copyRes.data.id
    if (!docId) throw new Error('Failed to copy template — no doc ID returned.')

    // ── 2. replaceAllText for UNIQUE header fields ─────────────────────────────
    // The template has sample data: "Vittorio Zenezini", "Video Editor", "Creative", "Jay Kishi"
    // and placeholder text: "SELECT ONE", "[INSERT EXAMPLE]", "positive or constructive"
    const SCORE_LABELS: Record<number, string> = {
      1: 'Unsatisfactory', 2: 'Needs Improvement', 3: 'Meets Expectations',
      4: 'Exceeds Job Requirements', 5: 'Outstanding',
    }

    const uniqueReplacements = [
      { from: 'Vittorio Zenezini',       to: form.employeeName     || '' },
      { from: 'Video Editor',            to: form.employeePosition || '' },
      { from: 'Creative',                to: form.employeeDivision || '' },
      { from: 'Jay Kishi',               to: form.supervisorName   || '' },
      // Competency 5 direction label
      { from: 'positive or constructive', to: form.competencyFiveType === 'positive' ? 'positive' : 'constructive' },
    ]

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: uniqueReplacements.map(r => ({
          replaceAllText: { containsText: { text: r.from, matchCase: true }, replaceText: r.to },
        })),
      },
    })

    // ── 3. Read updated document for position-based replacements ──────────────
    const docRes = await docs.documents.get({ documentId: docId })
    const runs   = flattenRuns(docRes.data.body?.content ?? [])
    const ops: ReplaceOp[] = []

    // ── 4. Competency names — "SELECT ONE" appears 5 times in order ───────────
    const compNames = [
      form.competencyOne.competency,   form.competencyTwo.competency,
      form.competencyThree.competency, form.competencyFour.competency,
      form.competencyFive.competency,
    ]
    const selectOnes = findOccurrences(runs, 'SELECT ONE')
    selectOnes.slice(0, 5).forEach((range, i) => {
      ops.push({ ...range, newText: compNames[i] || '' })
    })

    // ── 5. Examples — "[INSERT EXAMPLE]" appears 15 times in order ────────────
    const allExamples = [
      ...form.competencyOne.examples,   ...form.competencyTwo.examples,
      ...form.competencyThree.examples, ...form.competencyFour.examples,
      ...form.competencyFive.examples,
    ]
    const insertExamples = findOccurrences(runs, '[INSERT EXAMPLE]')
    insertExamples.slice(0, 15).forEach((range, i) => {
      ops.push({ ...range, newText: allExamples[i]?.trim() || '' })
    })

    // ── 6. Overall score — template has "4" in the score table cell ───────────
    // Find "OVERALL SCORE" label, then find the first isolated digit after it
    if (form.overallScore > 0) {
      const overallScoreLabel = findOccurrences(runs, 'OVERALL SCORE')
      if (overallScoreLabel.length > 0) {
        const afterScore = overallScoreLabel[overallScoreLabel.length - 1].endIndex
        // The score cell contains just "4" (or similar single digit)
        const fourOcc = findOccurrences(runs, '\n4\n')
          .filter(r => r.startIndex > afterScore)
        if (fourOcc.length > 0) {
          // Replace the "4" part (skip the surrounding \n)
          ops.push({
            startIndex: fourOcc[0].startIndex + 1,
            endIndex:   fourOcc[0].endIndex   - 1,
            newText:    String(form.overallScore),
          })
          // Append summary on the next line if provided
          if (form.overallSummary.trim()) {
            ops.push({
              startIndex: fourOcc[0].endIndex - 1,
              endIndex:   fourOcc[0].endIndex - 1,
              newText:    '\n' + form.overallSummary.trim(),
            })
          }
        }
      }
    }

    // ── 7. Appraisal Period — empty cell after "Appraisal Period:\n" ──────────
    //    In the template this cell is blank; find the \n immediately after the label cell
    if (form.appraisalPeriod) {
      const apLabel = findOccurrences(runs, 'Appraisal Period:\n')
      if (apLabel.length > 0) {
        const afterLabel = apLabel[0].endIndex
        // The next table cell starts here — it will have a \n (empty paragraph)
        const nextEmptyRun = runs.find(r => r.startIndex >= afterLabel && r.text === '\n')
        if (nextEmptyRun) {
          ops.push({ startIndex: nextEmptyRun.startIndex, endIndex: nextEmptyRun.startIndex, newText: form.appraisalPeriod })
        }
      }
    }

    // ── 8. Review Date ────────────────────────────────────────────────────────
    if (form.reviewDate) {
      const rvLabel = findOccurrences(runs, 'Review Date:\n')
      if (rvLabel.length > 0) {
        const afterLabel = rvLabel[0].endIndex
        const nextEmptyRun = runs.find(r => r.startIndex >= afterLabel && r.text === '\n')
        if (nextEmptyRun) {
          ops.push({ startIndex: nextEmptyRun.startIndex, endIndex: nextEmptyRun.startIndex, newText: form.reviewDate })
        }
      }
    }

    // ── 9. Goals 1–5 ──────────────────────────────────────────────────────────
    // The template goals section has numbered blank lines after the goals heading.
    // Find "Goals/Objectives/Accomplishments:" then locate each goal slot.
    // Each goal slot in the template is an empty paragraph (just \n) that follows
    // the numbered marker paragraph.
    const goalsSectionLabel = findOccurrences(runs, 'Goals/Objectives/Accomplishments:')
    if (goalsSectionLabel.length > 0) {
      const goalsStart = goalsSectionLabel[0].endIndex
      // Find "OVERALL SCORE" or "OVERALL PERFORMANCE" to know where goals section ends
      const goalsSectionEnd = findOccurrences(runs, 'OVERALL SCORE')
        .find(r => r.startIndex > goalsStart)?.startIndex ?? Infinity

      // Collect empty-ish paragraphs in the goals section (content = just \n or whitespace\n)
      // These are the blank goal cells following numbered markers
      const goalSlotRuns = runs.filter(r =>
        r.startIndex > goalsStart &&
        r.startIndex < goalsSectionEnd &&
        /^\s*\n$/.test(r.text)
      )

      const filledGoals = form.goals.filter(g => g.text.trim())
      filledGoals.forEach((goal, i) => {
        if (i < goalSlotRuns.length) {
          const slot = goalSlotRuns[i]
          const statusTag = goal.status ? ` (${goal.status.toUpperCase()})` : ''
          const explanation = goal.explanation.trim() ? `\n${goal.explanation.trim()}` : ''
          ops.push({
            startIndex: slot.startIndex,
            endIndex: slot.endIndex - 1, // keep the trailing \n
            newText: `${goal.text.trim()}${statusTag}${explanation}`,
          })
        }
      })
    }

    // ── 10. Next Year's Goals 1–3 ─────────────────────────────────────────────
    const nextGoalsSectionLabel = findOccurrences(runs, "Next Year's Goals")
    if (nextGoalsSectionLabel.length > 0) {
      const ngStart = nextGoalsSectionLabel[nextGoalsSectionLabel.length - 1].endIndex
      // Find signature area to bound our search
      const sigEnd = findOccurrences(runs, 'Employee Signature')
        .find(r => r.startIndex > ngStart)?.startIndex ?? Infinity

      const nextGoalSlotRuns = runs.filter(r =>
        r.startIndex > ngStart &&
        r.startIndex < sigEnd &&
        /^\s*\n$/.test(r.text)
      )

      const filledNextGoals = form.nextGoals.filter(g => g.text.trim())
      filledNextGoals.forEach((goal, i) => {
        if (i < nextGoalSlotRuns.length) {
          const slot = nextGoalSlotRuns[i]
          const dateStr = goal.targetDate.trim() ? `\nTarget Date: ${goal.targetDate.trim()}` : ''
          ops.push({
            startIndex: slot.startIndex,
            endIndex: slot.endIndex - 1,
            newText: `${goal.text.trim()}${dateStr}`,
          })
        }
      })
    }

    // ── 11. Apply all position-based changes ──────────────────────────────────
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
