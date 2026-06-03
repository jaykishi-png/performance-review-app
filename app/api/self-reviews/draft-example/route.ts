import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { competency, type, context, exampleIndex, employeeName } = await req.json() as {
      competency: string
      type: 'positive' | 'constructive' | 'choice'
      context: string
      exampleIndex: 0 | 1 | 2
      employeeName?: string
    }

    if (!competency || !context?.trim()) {
      return NextResponse.json({ error: 'competency and context required' }, { status: 400 })
    }

    const name = employeeName?.trim() || 'the employee'

    const directionMap = {
      positive: 'POSITIVE STRENGTH — celebrate what you do exceptionally well. Be specific about the behavior, its consistency, and its impact on your team or organization. Language should be affirmative and confident.',
      constructive: 'AREA FOR GROWTH — identify a specific behavior or gap where you are actively working to improve. Describe what you observed in yourself and how you are addressing it. Be honest and forward-looking.',
      choice: 'CHOSEN COMPETENCY — describe a specific behavior or skill that has been meaningful to your work this year. You may write this as a strength or a growth area.',
    }

    const systemPrompt = `You are an expert HR writer helping employees write their own self-assessments. Your job is to take an employee's raw notes and expand them into a polished, professional behavioral example written in the first person ("I"). The example should be specific, credible, and written as if the employee wrote it themselves. Expand on the notes with professional detail without fabricating facts. Always write in first person.`

    const distinctNote = exampleIndex > 0
      ? `\n\nNOTE: This is example ${exampleIndex + 1} of 3. Highlight a different angle or aspect of the notes than example 1 — vary the situation or framing while staying true to the same core content.`
      : ''

    const userPrompt = `COMPETENCY: ${competency}
DIRECTION: ${directionMap[type] ?? directionMap.choice}
EMPLOYEE: ${name}

MY NOTES:
"""
${context.trim()}
"""${distinctNote}

Write ONE polished behavioral example for the "${competency}" section of my self-assessment. Expand on my notes with professional language — make the behavior specific, vivid, and credible. Write entirely in first person ("I demonstrated…", "I worked to…", etc.). Do not just restate the notes verbatim; flesh them out into a complete, natural-sounding self-assessment sentence.

Output rules:
- 2–3 sentences in first person ("I", "my", "me")
- Grounded in my notes, expanded with professional detail
- Do NOT start with "The employee" or use third person at any point
- No bullets, numbers, quotes, or preamble
- Return the example text only`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    let example = ''
    const providerErrors: string[] = []

    // 1. Try Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const gemini = new OpenAI({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        })
        const res = await gemini.chat.completions.create({ model: 'gemini-2.0-flash', max_tokens: 200, messages })
        example = res.choices[0]?.message?.content?.trim() ?? ''
        if (example) return NextResponse.json({ example })
        providerErrors.push('Gemini: empty response')
      } catch (e) {
        providerErrors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      providerErrors.push('Gemini: no API key')
    }

    // 2. Try Anthropic Haiku
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        example = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
        if (example) return NextResponse.json({ example })
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
        const res = await openai.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 200, temperature: 0.7, messages })
        example = res.choices[0]?.message?.content?.trim() ?? ''
        if (example) return NextResponse.json({ example })
        providerErrors.push('OpenAI: empty response')
      } catch (e) {
        providerErrors.push(`OpenAI: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      providerErrors.push('OpenAI: no API key')
    }

    return NextResponse.json(
      { error: `All AI providers failed — ${providerErrors.join(' | ')}` },
      { status: 503 }
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
