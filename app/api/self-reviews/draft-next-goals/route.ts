import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { employeeName, competencies, currentGoals, overallRating } = await req.json() as {
      employeeName?: string
      competencies: Array<{ competency: string; type: string; examples: string[] }>
      currentGoals: Array<{ description: string; outcome: string; reasoning: string }>
      overallRating: number | null
    }

    const constructive = competencies.filter(c => c.type === 'constructive')
    const positive = competencies.filter(c => c.type === 'positive' || c.type === 'choice')

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

    const goalsBlock = currentGoals.length
      ? currentGoals.map(g =>
          `  • [${(g.outcome || 'not marked').toUpperCase()}] ${g.description}${g.reasoning ? `\n    → ${g.reasoning}` : ''}`
        ).join('\n')
      : '  (no goals recorded)'

    const systemPrompt = `You are an expert HR performance coach helping employees write their own next-year goals for a self-assessment. You turn the employee's constructive competency feedback directly into specific, actionable SMART goals written as the employee's personal commitments ("I will…", "I plan to…"). The constructive areas are your PRIMARY source — each goal should directly address a gap or improvement area identified there. Return only valid JSON — no markdown, no code fences, no explanation.`

    const userPrompt = `Generate 2–3 SMART goals for my next review period based on my self-assessment.

EMPLOYEE: ${employeeName?.trim() || 'the employee'}
OVERALL RATING: ${overallRating ? `${overallRating}/5` : 'not rated'}

━━━ MY CONSTRUCTIVE AREAS (PRIMARY SOURCE — base goals directly on these) ━━━
${constructiveBlock}

━━━ MY POSITIVE STRENGTHS (reference only) ━━━
${positiveBlock}

━━━ THIS YEAR'S GOALS ━━━
${goalsBlock}

Rules:
1. Each constructive competency area must produce at least one goal — these are non-negotiable
2. Goals must directly name the specific competency gap (e.g. "I will improve X by doing Y")
3. Carry forward any UNSUCCESSFUL or NOT MARKED goals from this year, reframed with a clear success metric
4. You may add ONE goal that leverages a positive strength into new responsibility — only if all constructive areas are already covered
5. Every goal must be specific and measurable — success should be obvious at review time
6. Goals should be written as the employee's personal commitments using "I will…" or "I plan to…"
7. The objective/roadmap should be a concrete action plan, not a vague intention

Return ONLY this JSON array (2–3 items), no other text:
[
  { "goal": "short goal title (e.g. I will improve my communication with stakeholders)", "objective": "specific roadmap of how I will achieve this goal" },
  { "goal": "...", "objective": "..." }
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
          model: 'claude-haiku-4-5',
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
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const goals = JSON.parse(cleaned)
    if (!Array.isArray(goals)) throw new Error('not an array')
    return NextResponse.json({ goals })
  } catch {
    return NextResponse.json({ error: `Could not parse AI response: ${raw.slice(0, 200)}` }, { status: 500 })
  }
}
