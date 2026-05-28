import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { competency, type, employeeName, role, context, exampleIndex } = await req.json() as {
      competency: string
      type: 'positive' | 'constructive'
      employeeName?: string
      role?: string
      context: string
      exampleIndex: 0 | 1 | 2
    }

    if (!competency || !context?.trim()) {
      return NextResponse.json({ error: 'competency and context required' }, { status: 400 })
    }

    const systemPrompt = `You are an expert HR performance review writer. Your job is to take a manager's raw notes and expand them into a polished, professional behavioral example for an annual performance review. Use the manager's notes as the foundation and anchor — then flesh out the detail with natural, professional HR language that makes the behavior vivid and credible. You may add reasonable, realistic context that is consistent with what the manager described, as long as it stays true to the spirit of their notes.`

    const distinctNote = exampleIndex > 0
      ? `\n\nNOTE: This is example ${exampleIndex + 1} of 3. Highlight a different angle or aspect of the manager's notes than you would for example 1 — vary the situation or framing while staying true to the same core feedback.`
      : ''

    const userPrompt = `COMPETENCY: ${competency}
DIRECTION: ${type === 'positive' ? 'POSITIVE STRENGTH — what they do well' : 'CONSTRUCTIVE AREA — where improvement is needed'}
EMPLOYEE: ${employeeName?.trim() || 'the employee'} (${role?.trim() || 'their role'})

MANAGER'S NOTES:
"""
${context.trim()}
"""${distinctNote}

Write ONE polished behavioral example for the "${competency}" section of a performance review. Expand on the manager's notes with professional language — make the behavior specific, vivid, and credible. Do not just restate the notes verbatim; flesh them out into a complete, natural-sounding review sentence.

Output rules:
- 2–3 sentences
- Grounded in the manager's notes, expanded with professional detail
- Do NOT start with "The employee"
- No bullets, numbers, quotes, or preamble
- Return the example text only`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    let example = ''

    // 1. Try Gemini Flash (cheapest, reliable)
    if (process.env.GEMINI_API_KEY) {
      try {
        const gemini = new OpenAI({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        })
        const res = await gemini.chat.completions.create({
          model: 'gemini-2.0-flash',
          max_tokens: 200,
          messages,
        })
        example = res.choices[0]?.message?.content?.trim() ?? ''
        if (example) return NextResponse.json({ example })
      } catch {
        // fall through to next provider
      }
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
      } catch {
        // fall through to next provider
      }
    }

    // 3. Try OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          temperature: 0.7,
          messages,
        })
        example = res.choices[0]?.message?.content?.trim() ?? ''
        if (example) return NextResponse.json({ example })
      } catch {
        // fall through
      }
    }

    if (!example) {
      return NextResponse.json({ error: 'No AI provider available or all providers failed' }, { status: 503 })
    }

    return NextResponse.json({ example })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
