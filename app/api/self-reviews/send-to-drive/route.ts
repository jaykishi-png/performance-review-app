import { NextRequest, NextResponse } from 'next/server'
import { google, docs_v1 } from 'googleapis'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

// Blank self-assessment template (copy + fill approach, same as manager review)
const SA_TEMPLATE_DOC_ID  = '14CTluQZ2yyLDrNLvx8fjtPycIZ9JFhxH_ukQzgsZqLE'
const SA_FOLDER           = '1vj8HSp0QnBlfwCoLvtzz-z3uJkh_84hg'

const STAR_LABELS: Record<number, string> = {
  5: 'Outstanding',
  4: 'Exceeds Job Requirements',
  3: 'Meets Expectations',
  2: 'Needs Improvement',
  1: 'Unsatisfactory',
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     (process.env.GOOGLE_CLIENT_ID     ?? '').trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
      refresh_token: (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? '').trim(),
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) throw new Error(`Google token error: ${data.error} — ${data.error_description}`)
  return data.access_token
}

function getAuth(token: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })
  return auth
}

// ── Text run helpers (same pattern as manager review) ─────────────────────────
interface TextRun { text: string; startIndex: number; endIndex: number }
interface ReplaceOp { startIndex: number; endIndex: number; newText: string }

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

function findOccurrences(runs: TextRun[], searchText: string): { startIndex: number; endIndex: number }[] {
  const results: { startIndex: number; endIndex: number }[] = []
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

function buildRequests(ops: ReplaceOp[]): docs_v1.Schema$Request[] {
  const sorted = [...ops].sort((a, b) => b.startIndex - a.startIndex)
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

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      employeeName: string
      employeePosition: string
      supervisorName: string
      appraisalPeriod: string
      dateCompleted: string
      competencies: Array<{ type: string; term: string; definition: string; examples: string[] }>
      goalsObjectives: Array<{ description: string; outcome: string; reasoning: string }>
      overallRating: number | null
      nextYearGoals: Array<{ goal: string; objective: string }>
      selfReviewId?: string
      driveFolderId?: string
    }

    const targetFolder = body.driveFolderId?.trim() || SA_FOLDER

    const accessToken = await getAccessToken()
    const auth  = getAuth(accessToken)
    const drive = google.drive({ version: 'v3', auth })
    const docs  = google.docs({ version: 'v1', auth })

    // ── 1. Copy the blank template ──────────────────────────────────────────
    const safeName   = (body.employeeName || 'Employee').replace(/[^a-zA-Z0-9]/g, '')
    const safePeriod = (body.appraisalPeriod || 'Period').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    const docTitle   = `${safeName}_SelfAssessment_${safePeriod}`

    const copyRes = await drive.files.copy({
      fileId: SA_TEMPLATE_DOC_ID,
      requestBody: { name: docTitle, parents: [targetFolder] },
      fields: 'id',
    })
    const docId = copyRes.data.id
    if (!docId) throw new Error('Failed to copy template — no ID returned.')

    // ── 2. Read all text runs from the copied document ──────────────────────
    const docData = await docs.documents.get({ documentId: docId })
    const runs = flattenRuns(docData.data.body?.content ?? [])

    const ops: ReplaceOp[] = []

    // ── 3. Replace fixed info fields ────────────────────────────────────────

    // Employee name: [NAME]
    const nameOccs = findOccurrences(runs, '[NAME]')
    if (nameOccs[0]) ops.push({ ...nameOccs[0], newText: body.employeeName || '—' })

    // Appraisal period: [YYYY - YYYY (with possible trailing chars)
    // Template text is "[YYYY - YYYY-" per HTML analysis
    const periodSearch = '[YYYY - YYYY'
    const periodOccs = findOccurrences(runs, periodSearch)
    if (periodOccs[0]) {
      // Find end of the full placeholder bracket
      const run = runs.find(r => r.startIndex <= periodOccs[0].startIndex && r.endIndex >= periodOccs[0].startIndex)
      if (run) {
        const relStart = periodOccs[0].startIndex - run.startIndex
        // Find the closing ']' or end of pattern
        const remaining = run.text.slice(relStart)
        const closeIdx = remaining.indexOf(']')
        const fullEnd = closeIdx !== -1
          ? run.startIndex + relStart + closeIdx + 1
          : periodOccs[0].endIndex + 2 // skip trailing dash+bracket if present
        ops.push({ startIndex: periodOccs[0].startIndex, endIndex: fullEnd, newText: body.appraisalPeriod || '—' })
      } else {
        ops.push({ ...periodOccs[0], newText: body.appraisalPeriod || '—' })
      }
    }

    // ── 4. Replace SELECT ONE instances in document order ───────────────────
    // Order in template: [0] employee position, [1] supervisor name,
    //                    [2-6] competency 1-5 terms, [7] overall score
    const selectOccs = findOccurrences(runs, 'SELECT ONE')

    if (selectOccs[0]) ops.push({ ...selectOccs[0], newText: body.employeePosition || '—' })
    if (selectOccs[1]) ops.push({ ...selectOccs[1], newText: body.supervisorName || '—' })

    body.competencies.forEach((comp, i) => {
      if (selectOccs[i + 2]) ops.push({ ...selectOccs[i + 2], newText: comp.term || '—' })
    })

    // Overall score (selectOccs[7])
    const ratingText = body.overallRating && STAR_LABELS[body.overallRating]
      ? `${'★'.repeat(body.overallRating)}${'☆'.repeat(5 - body.overallRating)}  ${body.overallRating}/5 — ${STAR_LABELS[body.overallRating]}`
      : 'Not rated'
    if (selectOccs[7]) ops.push({ ...selectOccs[7], newText: ratingText })

    // ── 5. Replace [INSERT EXAMPLE] placeholders (15 total: 3 per competency) ──
    const exOccs = findOccurrences(runs, '[INSERT EXAMPLE]')
    let exIdx = 0
    body.competencies.forEach(comp => {
      for (let j = 0; j < 3; j++) {
        if (exOccs[exIdx]) {
          ops.push({ ...exOccs[exIdx], newText: comp.examples[j]?.trim() || '' })
        }
        exIdx++
      }
    })

    // ── 6. Fill goals (numbered items after instruction text) ────────────────
    // Goals section items are standalone "1.", "2.", ... "5." runs (no example text)
    // We identify them as runs whose text is a single digit+period with no following
    // [INSERT EXAMPLE] text in the same paragraph region
    const goalItems = runs.filter(r => /^\d\.\s*$/.test(r.text.replace('\n', '')))
    // The first 5 such items (after all example items are accounted for) are goals,
    // the next 3 are next-year goals. We find them by position after exOccs ends.
    const lastExamplePos = exOccs[exOccs.length - 1]?.endIndex ?? 0

    const goalsAndNextGoals = goalItems
      .filter(r => r.startIndex > lastExamplePos)
      .sort((a, b) => a.startIndex - b.startIndex)

    // First 5 = goals section, next 3 = next year goals
    const goalRuns   = goalsAndNextGoals.slice(0, 5)
    const nextGoalRuns = goalsAndNextGoals.slice(5, 8)

    const filledGoals = body.goalsObjectives.filter(g => g.description?.trim())
    filledGoals.forEach((goal, i) => {
      if (goalRuns[i]) {
        const lines: string[] = [`${i + 1}.  ${goal.description.trim()}`]
        if (goal.outcome) lines.push(`  Outcome: ${goal.outcome.charAt(0).toUpperCase() + goal.outcome.slice(1)}`)
        if (goal.reasoning?.trim()) lines.push(`  Reason: ${goal.reasoning.trim()}`)
        ops.push({ startIndex: goalRuns[i].startIndex, endIndex: goalRuns[i].endIndex, newText: lines.join('\n') })
      }
    })

    const filledNextGoals = body.nextYearGoals.filter(g => g.goal?.trim())
    filledNextGoals.forEach((goal, i) => {
      if (nextGoalRuns[i]) {
        const lines: string[] = [`${i + 1}.  ${goal.goal.trim()}`]
        if (goal.objective?.trim()) lines.push(`  Objective / Roadmap: ${goal.objective.trim()}`)
        ops.push({ startIndex: nextGoalRuns[i].startIndex, endIndex: nextGoalRuns[i].endIndex, newText: lines.join('\n') })
      }
    })

    // ── 7. Apply all replacements ───────────────────────────────────────────
    const requests = buildRequests(ops)
    if (requests.length > 0) {
      const CHUNK = 50
      for (let i = 0; i < requests.length; i += CHUNK) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: requests.slice(i, i + CHUNK) },
        })
      }
    }

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`

    // ── 8. Persist drive fields ─────────────────────────────────────────────
    if (body.selfReviewId) {
      const serviceClient = createServiceClient()
      await serviceClient
        .from('self_reviews')
        .update({ drive_doc_id: docId, drive_url: docUrl })
        .eq('id', body.selfReviewId)
        .eq('employee_id', user.id)
    }

    return NextResponse.json({ docId, docUrl, docTitle })
  } catch (err) {
    console.error('[self-review/send-to-drive]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
