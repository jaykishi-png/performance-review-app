import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 60

// ─── Auth helper (reused from send-to-drive) ──────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
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
  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`Google auth failed: ${data.error}`)
  return data.access_token
}

// ─── Extract Google Doc ID from URL ──────────────────────────────────────────
function extractDocId(urlOrId: string): string | null {
  const match = urlOrId.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(urlOrId.trim())) return urlOrId.trim()
  return null
}

// ─── Fetch plain text from a Google Doc ──────────────────────────────────────
async function fetchGoogleDocText(docId: string): Promise<string> {
  const token = await getGoogleAccessToken()

  // 1. Try the native Google Docs API (works for native .gdoc files)
  const docsRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (docsRes.ok) {
    const doc = await docsRes.json() as { body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> } }
    const lines: string[] = []
    for (const el of doc.body?.content ?? []) {
      if (!el.paragraph?.elements) continue
      const line = el.paragraph.elements.map(pe => pe.textRun?.content ?? '').join('')
      if (line.trim()) lines.push(line.trimEnd())
    }
    return lines.join('\n')
  }

  // 2. Fallback: Drive export API (handles Word docs, converted files, etc.)
  const exportRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text%2Fplain`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (exportRes.ok) {
    return await exportRes.text()
  }

  // 3. Fallback: Drive download (for plain text files stored in Drive)
  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (downloadRes.ok) {
    return await downloadRes.text()
  }

  // All methods failed — give a helpful error
  const status = docsRes.status
  if (status === 403) {
    throw new Error(
      'Access denied (403). Make sure the document is shared with the Google account linked to this app, or change the sharing to "Anyone with the link can view".'
    )
  }
  throw new Error(
    `Could not read the Google Doc (${status}). Make sure the document is shared with "Anyone with the link" or with the linked Google account, then try again.`
  )
}

// ─── Build a structured summary of the manager's review ──────────────────────
interface FormData {
  employeeName: string; employeePosition: string; employeeDivision: string
  supervisorName: string; appraisalPeriod: string; reviewDate: string
  competencyOne:   { competency: string; examples: [string, string, string] }
  competencyTwo:   { competency: string; examples: [string, string, string] }
  competencyThree: { competency: string; examples: [string, string, string] }
  competencyFour:  { competency: string; examples: [string, string, string] }
  competencyFive:  { competency: string; examples: [string, string, string] }
  competencyFiveType: 'positive' | 'constructive'
  goals: Array<{ text: string; status: string; explanation: string }>
  overallScore: number; overallSummary: string
  nextGoals: Array<{ text: string; targetDate: string }>
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Unsatisfactory', 2: 'Needs Improvement', 3: 'Meets Expectations',
  4: 'Exceeds Job Requirements', 5: 'Outstanding',
}

function buildManagerSummary(form: FormData): string {
  const comps = [
    { entry: form.competencyOne,   type: 'Positive Strength',   ord: 'ONE' },
    { entry: form.competencyTwo,   type: 'Positive Strength',   ord: 'TWO' },
    { entry: form.competencyThree, type: 'Constructive Area',   ord: 'THREE' },
    { entry: form.competencyFour,  type: 'Constructive Area',   ord: 'FOUR' },
    { entry: form.competencyFive,  type: form.competencyFiveType === 'positive' ? 'Positive Strength' : 'Constructive Area', ord: 'FIVE' },
  ]

  const compText = comps.map(c => {
    const examples = c.entry.examples.filter(e => e.trim())
    return `Competency ${c.ord} (${c.type}): ${c.entry.competency || '—'}\n` +
      examples.map((e, i) => `  ${i + 1}. ${e.trim()}`).join('\n')
  }).join('\n\n')

  const filledGoals = form.goals.filter(g => g.text.trim())
  const goalsText = filledGoals.length
    ? filledGoals.map((g, i) => {
        const status = g.status ? ` [${g.status.toUpperCase()}]` : ''
        const expl = g.explanation.trim() ? `\n     Explanation: ${g.explanation.trim()}` : ''
        return `  ${i + 1}. ${g.text.trim()}${status}${expl}`
      }).join('\n')
    : '  (no goals recorded)'

  const nextGoalsText = form.nextGoals.filter(g => g.text.trim())
    .map((g, i) => `  ${i + 1}. ${g.text.trim()}${g.targetDate ? ` (Target: ${g.targetDate})` : ''}`)
    .join('\n') || '  (none recorded)'

  return `MANAGER'S PERFORMANCE REVIEW
==============================
Employee: ${form.employeeName} | ${form.employeePosition} | ${form.employeeDivision}
Supervisor: ${form.supervisorName}
Period: ${form.appraisalPeriod} | Review Date: ${form.reviewDate}

── PART ONE: COMPETENCY EVALUATION ──
${compText}

── PART TWO: GOALS & OVERALL PERFORMANCE ──
Goals / Objectives / Accomplishments:
${goalsText}

Overall Score: ${form.overallScore}${form.overallScore ? ` — ${SCORE_LABELS[form.overallScore]}` : ''}
${form.overallSummary.trim() ? `Overall Summary:\n${form.overallSummary.trim()}` : ''}

── PART THREE: NEXT YEAR'S GOALS ──
${nextGoalsText}`
}

// ─── AI comparison ────────────────────────────────────────────────────────────
async function generateComparison(managerSummary: string, employeeText: string, employeeName: string): Promise<string> {
  const system = `You are an expert HR analyst and executive coach specializing in performance management. Your job is to compare a manager's formal performance review with an employee's self-review and produce a structured, insightful comparison report for use in a face-to-face performance review meeting.

Your analysis must be balanced, constructive, and actionable. Focus on substance, not surface-level differences. Highlight both genuine alignment and meaningful divergence.`

  const prompt = `Compare these two performance review documents for ${employeeName || 'the employee'} and produce a structured comparison report.

════════════════════════════════════════
MANAGER'S REVIEW:
════════════════════════════════════════
${managerSummary}

════════════════════════════════════════
EMPLOYEE'S SELF-REVIEW:
════════════════════════════════════════
${employeeText}

════════════════════════════════════════

Produce a comparison report with EXACTLY these sections, using the headers below:

## ALIGNMENT SNAPSHOT
A 2–3 sentence executive summary of how aligned the manager and employee perspectives are overall. Include a rough alignment rating (High / Moderate / Low) and why.

## WHERE WE AGREE
List 3–6 specific areas where the manager's and employee's views are clearly aligned — same competencies highlighted, similar goal assessments, shared priorities. Be specific, not generic.

## WHERE WE DIFFER
List 4–8 specific areas of divergence. For each, describe:
- What the manager believes
- What the employee believes
- Why this gap matters and what it might signal

## TALKING POINTS FOR THE MEETING
Provide 5–8 concrete, conversation-ready prompts the manager can use to open dialogue around the key differences. Frame them as open questions or statements that invite honest reflection from the employee.

## GOAL ALIGNMENT REVIEW
For each goal or goal area, note whether the manager and employee are in agreement on status and direction, or whether there's a gap to address.

## RECOMMENDED ACTION PLAN
Based on the gaps identified, provide 4–6 specific, actionable items for the manager to propose in the meeting. Each item should include:
- The action
- Who owns it
- A suggested timeframe

Keep the tone professional, constructive, and forward-looking throughout.`

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: prompt }
  ]

  const providerErrors: string[] = []

  // 1. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const gemini = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      })
      const res = await gemini.chat.completions.create({
        model: 'gemini-2.0-flash',
        max_tokens: 2000,
        messages: [{ role: 'system', content: system }, ...messages],
      })
      const text = res.choices[0]?.message?.content?.trim()
      if (text) return text
      providerErrors.push('Gemini: empty response')
    } catch (e) {
      providerErrors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`)
    }
  } else {
    providerErrors.push('Gemini: no API key')
  }

  // 2. Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system,
        messages,
      })
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
      if (text) return text
      providerErrors.push('Anthropic: empty response')
    } catch (e) {
      providerErrors.push(`Anthropic: ${e instanceof Error ? e.message : String(e)}`)
    }
  } else {
    providerErrors.push('Anthropic: no API key')
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [{ role: 'system', content: system }, ...messages],
      })
      const text = res.choices[0]?.message?.content?.trim()
      if (text) return text
      providerErrors.push('OpenAI: empty response')
    } catch (e) {
      providerErrors.push(`OpenAI: ${e instanceof Error ? e.message : String(e)}`)
    }
  } else {
    providerErrors.push('OpenAI: no API key')
  }

  throw new Error(`All AI providers failed — ${providerErrors.join(' | ')}`)
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      form: FormData
      employeeDocUrl?: string
      employeeText?: string
    }

    const { form, employeeDocUrl, employeeText } = body

    // Get employee document text
    let docText = (employeeText ?? '').trim()

    if (!docText && employeeDocUrl?.trim()) {
      const docId = extractDocId(employeeDocUrl.trim())
      if (!docId) throw new Error('Could not extract a Google Doc ID from the URL provided.')
      docText = await fetchGoogleDocText(docId)
    }

    if (!docText) throw new Error('No employee self-review text provided.')
    if (docText.length < 50) throw new Error('Employee self-review appears too short to analyze. Please provide more content.')

    const managerSummary = buildManagerSummary(form)
    const report = await generateComparison(managerSummary, docText, form.employeeName)

    return NextResponse.json({ report })
  } catch (err) {
    console.error('[compare-reviews]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
