import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const {
      goalIndex, existingGoals, userGuidance,
      employeeName, role, appraisalPeriod, nextAppraisalPeriod,
      competencies, goals, overallScore, overallSummary,
    } = await req.json() as {
      goalIndex: number
      existingGoals: Array<{ text: string; targetDate: string }>
      userGuidance?: string
      employeeName: string
      role: string
      appraisalPeriod: string
      nextAppraisalPeriod: string
      competencies: Array<{ competency: string; type: string; examples: string[] }>
      goals: Array<{ text: string; status: string; explanation: string }>
      overallScore: number
      overallSummary: string
    }

    const targetDate = nextAppraisalPeriod || 'next appraisal period'

    const constructive = competencies.filter(c => c.type === 'constructive')
    const positive     = competencies.filter(c => c.type === 'positive')

    const formatComp = (c: { competency: string; examples: string[] }) =>
      `  ${c.competency}: ${c.examples.filter(e => e.trim()).join('; ') || '(no examples)'}`

    const constructiveBlock = constructive.length ? constructive.map(formatComp).join('\n') : '  (none recorded)'
    const positiveBlock     = positive.length     ? positive.map(formatComp).join('\n')     : '  (none recorded)'

    const goalsBlock = goals.length
      ? goals.map(g => `  • [${(g.status || 'unmarked').toUpperCase()}] ${g.text}`).join('\n')
      : '  (none recorded)'

    const existingBlock = existingGoals
      .filter((g, i) => i !== goalIndex && g.text.trim())
      .map(g => `  • ${g.text}`)
      .join('\n') || '  (none yet)'

    const slotLabel = goalIndex === 0 ? 'primary' : goalIndex === 1 ? 'secondary' : 'third'

    const systemPrompt = `You are an expert HR performance coach. You generate a single specific, measurable SMART goal for an employee's next annual review period. Goals must be rooted in the constructive competency feedback — that is the primary source. Return only valid JSON — no markdown, no explanation.`

    const userPrompt = `Generate ONE alternative SMART goal for goal slot ${goalIndex + 1} (the ${slotLabel} goal).

EMPLOYEE: ${employeeName || 'the employee'} — ${role || 'their role'}
REVIEW PERIOD: ${appraisalPeriod || 'not specified'}
TARGET DATE: ${targetDate}

━━━ CONSTRUCTIVE AREAS (PRIMARY SOURCE — goal must address one of these) ━━━
${constructiveBlock}

━━━ POSITIVE STRENGTHS (secondary reference only) ━━━
${positiveBlock}

━━━ THIS YEAR'S GOALS (outcomes) ━━━
${goalsBlock}

━━━ ALREADY DRAFTED GOALS (make this one DIFFERENT in theme and focus) ━━━
${existingBlock}
${userGuidance ? `
━━━ MANAGER'S SPECIFIC REQUEST (highest priority — follow this above all else) ━━━
  ${userGuidance}
` : ''}
Rules:
${userGuidance
  ? `- The manager's specific request above overrides all other guidance — build the goal around it`
  : `- Root the goal in a CONSTRUCTIVE competency area not already covered by the drafted goals above`}
- If all constructive areas are covered, use a positive strength to frame a stretch goal
- Must be specific and measurable — success should be objectively verifiable
- Different in theme/focus from every already-drafted goal
- Set targetDate to "${targetDate}"

Return ONLY this JSON object, no other text:
{ "text": "...", "targetDate": "${targetDate}" }`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    let raw = ''

    if (process.env.GEMINI_API_KEY) {
      try {
        const gemini = new OpenAI({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        })
        const res = await gemini.chat.completions.create({ model: 'gemini-2.0-flash', max_tokens: 300, messages })
        raw = res.choices[0]?.message?.content?.trim() ?? ''
        if (raw) return parseAndRespond(raw)
      } catch { /* fall through */ }
    }

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022', max_tokens: 300,
          system: systemPrompt, messages: [{ role: 'user', content: userPrompt }],
        })
        raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
        if (raw) return parseAndRespond(raw)
      } catch { /* fall through */ }
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await openai.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 300, messages })
        raw = res.choices[0]?.message?.content?.trim() ?? ''
        if (raw) return parseAndRespond(raw)
      } catch { /* fall through */ }
    }

    return NextResponse.json({ error: 'No AI provider available' }, { status: 503 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function parseAndRespond(raw: string): NextResponse {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const goal = JSON.parse(cleaned)
    if (typeof goal.text !== 'string') throw new Error('missing text field')
    return NextResponse.json({ goal })
  } catch {
    return NextResponse.json({ error: `Could not parse AI response: ${raw.slice(0, 200)}` }, { status: 500 })
  }
}
