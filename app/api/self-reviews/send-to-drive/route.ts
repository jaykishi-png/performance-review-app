import { NextRequest, NextResponse } from 'next/server'
import { google, docs_v1 } from 'googleapis'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const SA_TEMPLATE_DOC_ID  = '14CTluQZ2yyLDrNLvx8fjtPycIZ9JFhxH_ukQzgsZqLE'
const SA_FOLDER           = '1vj8HSp0QnBlfwCoLvtzz-z3uJkh_84hg'

const STAR_LABELS: Record<number, string> = {
  5: 'Outstanding',
  4: 'Exceeds Job Requirements',
  3: 'Meets Expectations',
  2: 'Needs Improvement',
  1: 'Unsatisfactory',
}

// -- Auth ---------------------------------------------------------------------
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
  if (!res.ok || !data.access_token) throw new Error(`Google token error: ${data.error} -- ${data.error_description}`)
  return data.access_token
}

function getAuth(token: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })
  return auth
}

// -- Text run helpers ---------------------------------------------------------
interface TextRun {
  text: string
  startIndex: number
  endIndex: number
}
interface ReplaceOp { startIndex: number; endIndex: number; newText: string }

function flattenRuns(content: docs_v1.Schema$StructuralElement[]): TextRun[] {
  const runs: TextRun[] = []
  function walk(els: docs_v1.Schema$StructuralElement[]) {
    for (const el of els) {
      if (el.paragraph?.elements) {
        for (const pe of el.paragraph.elements) {
          if (pe.startIndex == null || pe.endIndex == null) continue
          if (pe.textRun?.content) {
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
  const scheduled: { start: number; end: number }[] = []
  const reqs: docs_v1.Schema$Request[] = []

  for (const op of sorted) {
    if (op.startIndex >= op.endIndex) continue
    const overlaps = scheduled.some(s => op.startIndex < s.end && op.endIndex > s.start)
    if (overlaps) continue
    scheduled.push({ start: op.startIndex, end: op.endIndex })

    reqs.push({ deleteContentRange: { range: { startIndex: op.startIndex, endIndex: op.endIndex } } })
    if (op.newText) {
      reqs.push({ insertText: { location: { index: op.startIndex }, text: op.newText } })
    }
  }
  return reqs
}

// -- POST ---------------------------------------------------------------------
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

    // 1. Copy the blank template
    const safeName   = (body.employeeName || 'Employee').replace(/[^a-zA-Z0-9]/g, '')
    const safePeriod = (body.appraisalPeriod || 'Period').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    const docTitle   = `${safeName}_SelfAssessment_${safePeriod}`

    const copyRes = await drive.files.copy({
      fileId: SA_TEMPLATE_DOC_ID,
      requestBody: { name: docTitle, parents: [targetFolder] },
      fields: 'id',
    })
    const docId = copyRes.data.id
    if (!docId) throw new Error('Failed to copy template -- no ID returned.')

    // 2. Read all text runs from the copied document
    const docData = await docs.documents.get({ documentId: docId })
    const runs = flattenRuns(docData.data.body?.content ?? [])

    const ops: ReplaceOp[] = []

    // 3. [NAME]
    const nameOccs = findOccurrences(runs, '[NAME]')
    if (nameOccs[0]) ops.push({ ...nameOccs[0], newText: body.employeeName || '--' })

    // 4. [YYYY - YYYY...] appraisal period
    const periodOccs = findOccurrences(runs, '[YYYY - YYYY')
    if (periodOccs[0]) {
      const run = runs.find(r => r.startIndex <= periodOccs[0].startIndex && r.endIndex > periodOccs[0].startIndex)
      if (run) {
        const relStart = periodOccs[0].startIndex - run.startIndex
        const remaining = run.text.slice(relStart)
        const closeIdx = remaining.indexOf(']')
        const fullEnd = closeIdx !== -1
          ? Math.min(run.startIndex + relStart + closeIdx + 1, run.endIndex)
          : Math.min(periodOccs[0].endIndex + 2, run.endIndex)
        ops.push({ startIndex: periodOccs[0].startIndex, endIndex: fullEnd, newText: body.appraisalPeriod || '--' })
      } else {
        ops.push({ ...periodOccs[0], newText: body.appraisalPeriod || '--' })
      }
    }

    // 5. Plain-text placeholders added to template in place of dropdown chips
    const posOcc = findOccurrences(runs, '[POSITION]')
    if (posOcc[0]) ops.push({ ...posOcc[0], newText: body.employeePosition || '--' })

    const supOcc = findOccurrences(runs, '[SUPERVISOR]')
    if (supOcc[0]) ops.push({ ...supOcc[0], newText: body.supervisorName || '--' })

    const compPlaceholders = ['[COMP_1]', '[COMP_2]', '[COMP_3]', '[COMP_4]', '[COMP_5]']
    body.competencies.forEach((comp, i) => {
      const occ = findOccurrences(runs, compPlaceholders[i])
      if (occ[0]) ops.push({ ...occ[0], newText: comp.term || '--' })
    })

    const ratingText = body.overallRating && STAR_LABELS[body.overallRating]
      ? `${'★'.repeat(body.overallRating)}${'☆'.repeat(5 - body.overallRating)}  ${body.overallRating}/5 -- ${STAR_LABELS[body.overallRating]}`
      : 'Not rated'
    const scoreOcc = findOccurrences(runs, '[OVERALL_SCORE]')
    if (scoreOcc[0]) ops.push({ ...scoreOcc[0], newText: ratingText })

    // 6. [INSERT EXAMPLE] placeholders (15 total: 3 per competency)
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

    // 7. Numbered goal items after the examples section
    function safeEnd(r: TextRun) {
      return r.text.endsWith('\n') ? r.endIndex - 1 : r.endIndex
    }

    const goalItems = runs.filter(r => /^\d\.\s*\n?$/.test(r.text) && r.endIndex > r.startIndex)
    const lastExamplePos = exOccs[exOccs.length - 1]?.endIndex ?? 0

    const goalsAndNextGoals = goalItems
      .filter(r => r.startIndex > lastExamplePos)
      .sort((a, b) => a.startIndex - b.startIndex)

    const goalRuns     = goalsAndNextGoals.slice(0, 5)
    const nextGoalRuns = goalsAndNextGoals.slice(5, 8)

    const filledGoals = body.goalsObjectives.filter(g => g.description?.trim())
    filledGoals.forEach((goal, i) => {
      if (goalRuns[i] && safeEnd(goalRuns[i]) > goalRuns[i].startIndex) {
        const lines: string[] = [`${i + 1}.  ${goal.description.trim()}`]
        if (goal.outcome) lines.push(`  Outcome: ${goal.outcome.charAt(0).toUpperCase() + goal.outcome.slice(1)}`)
        if (goal.reasoning?.trim()) lines.push(`  Reason: ${goal.reasoning.trim()}`)
        ops.push({ startIndex: goalRuns[i].startIndex, endIndex: safeEnd(goalRuns[i]), newText: lines.join('\n') })
      }
    })

    const filledNextGoals = body.nextYearGoals.filter(g => g.goal?.trim())
    filledNextGoals.forEach((goal, i) => {
      if (nextGoalRuns[i] && safeEnd(nextGoalRuns[i]) > nextGoalRuns[i].startIndex) {
        const lines: string[] = [`${i + 1}.  ${goal.goal.trim()}`]
        if (goal.objective?.trim()) lines.push(`  Objective / Roadmap: ${goal.objective.trim()}`)
        ops.push({ startIndex: nextGoalRuns[i].startIndex, endIndex: safeEnd(nextGoalRuns[i]), newText: lines.join('\n') })
      }
    })

    // 8. Apply all replacements
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

    // 9. Share doc with employee and their manager (non-blocking)
    try {
      const shareEmails: string[] = []

      // Employee (logged-in user)
      if (user.email) shareEmails.push(user.email)

      // Manager — look up from employee's profile
      const serviceClient = createServiceClient()
      const { data: empProfile } = await serviceClient
        .from('profiles')
        .select('manager_id')
        .eq('id', user.id)
        .single()

      if (empProfile?.manager_id) {
        const { data: managerProfile } = await serviceClient
          .from('profiles')
          .select('email')
          .eq('id', empProfile.manager_id)
          .single()
        if (managerProfile?.email) shareEmails.push(managerProfile.email)
      }

      for (const email of shareEmails.filter(Boolean)) {
        try {
          await drive.permissions.create({
            fileId: docId,
            requestBody: { type: 'user', role: 'reader', emailAddress: email },
            sendNotificationEmail: false,
          })
        } catch { /* non-blocking */ }
      }
    } catch { /* non-blocking */ }

    // 11. Persist drive fields
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
