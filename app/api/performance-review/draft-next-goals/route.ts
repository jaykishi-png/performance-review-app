import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const {
      employeeName, role, appraisalPeriod, nextAppraisalPeriod,
      competencies, goals, overallScore, overallSummary,
    } = await req.json() as {
      employeeName: string
      role: string
      appraisalPeriod: string
      nextAppraisalPeriod: string
      competencies: Array<{ competency: string; type: string; examples: string[] }>
      goals: Array<{ text: string; status: string; explanation: string }>
      overallScore: number
      overallSummary: string
    }

    const targetDate = nextAppraisalPeriod || 'end of next review period'

    // Split competencies into constructive vs positive for emphasis
    const constructive = competencies.filter(c => c.type === 'constructive')
    const positive     = competencies.filter(c => c.type === 'positive')

    const formatComp = (c: { competency: string; examples: string[] }) =>
      `  ${c.competency}:\n${
        c.examples.filter(e => e.trim()).map(e => `    • ${e}`).join('\n') || '    • (no examples recorded)'
      }`

    const constructiveBlock = constructive.length
      ? constructive.map(formatComp).join('\n\n')
      : '  (none recorded)'

    const positiveBlock = positive.length
      ? positive.map(formatComp).join('\n\n')
      : '  (none recorded)'

    const goalsBlock = goals.length
      ? goals.map(g =>
          `  • [${(g.status || 'not marked').toUpperCase()}] ${g.text}${g.explanation ? `\n    → ${g.explanation}` : ''}`
        ).join('\n')
      : '  (no goals recorded)'

    const systemPrompt = `You are an expert HR performance coach. You turn an employee's constructive competency feedback directly into specific, actionable SMART goals for their next review period. The constructive areas are your PRIMARY source — each goal should directly address a gap or improvement area identified there. Return only valid JSON — no markdown, no code fences, no explanation.`

    const userPrompt = `Generate 2–3 SMART goals for the next review period based on this annual performance review.

EMPLOYEE: ${employeeName || 'the employee'} — ${role || 'their role'}
CURRENT PERIOD: ${appraisalPeriod || 'not specified'}
TARGET DATE: ${targetDate}

━━━ CONSTRUCTIVE AREAS (PRIMARY SOURCE — base goals directly on these) ━━━
${constructiveBlock}

━━━ POSITIVE STRENGTHS (reference only — use to frame one stretch goal) ━━━
${positiveBlock}

━━━ THIS YEAR'S GOALS ━━━
${goalsBlock}

━━━ OVERALL SCORE ━━━
${overallScore > 0 ? `${overallScore}/5` : 'not scored'}${overallSummary ? ` — ${overallSummary}` : ''}

Rules:
1. EACH constructive competency area must produce at least one goal — these are non-negotiable
2. Goals must directly name the specific competency gap (e.g. "improve X by doing Y") — not vague intentions
3. Carry forward any UNSUCCESSFUL or ONGOING goals from this year, reframed with a clear success metric
4. You may add ONE goal that leverages a positive strength into new responsibility — only if all constructive areas are already covered
5. Every goal must be specific and measurable enough that success is obvious at review time
6. Set targetDate to "${targetDate}" for all goals

Return ONLY this JSON array (2–3 items), no other text:
[
  { "text": "...", "targetDate": "${targetDate}" },
  { "text": "...", "targetDate": "${targetDate}" }
]`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    let raw = ''

    // 1. Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const gemini = new OpenAI({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        })
        const res = await gemini.chat.completions.create({ model: 'gemini-2.0-flash', max_tokens: 600, messages })
        raw = res.choices[0]?.message?.content?.trim() ?? ''
        if (raw) return parseAndRespond(raw)
      } catch { /* fall through */ }
    }

    // 2. Anthropic Haiku
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
        if (raw) return parseAndRespond(raw)
      } catch { /* fall through */ }
    }

    // 3. OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await openai.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 600, messages })
        raw = res.choices[0]?.message?.content?.trim() ?? ''
        if (raw) return parseAndRespond(raw)
      } catch { /* fall through */ }
    }

    return NextResponse.json({ error: 'No AI provider available or all providers failed' }, { status: 503 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function parseAndRespond(raw: string): NextResponse {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const goals = JSON.parse(cleaned)
    if (!Array.isArray(goals)) throw new Error('not an array')
    return NextResponse.json({ goals })
  } catch {
    return NextResponse.json({ error: `Could not parse AI response: ${raw.slice(0, 200)}` }, { status: 500 })
  }
}
