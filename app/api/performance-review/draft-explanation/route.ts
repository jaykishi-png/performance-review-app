import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

const DIRECTION: Record<string, string> = {
  successful: 'This goal was SUCCESSFULLY completed. Explain what the employee did well, what they accomplished, or the impact it had. Be positive and specific.',
  unsuccessful: 'This goal was NOT completed or not met. Explain constructively — what challenges arose, what could have gone differently, or what factors contributed. Be honest but fair.',
  ongoing: 'This goal is STILL IN PROGRESS and carries over to the next review period. Explain what has been accomplished so far, where it currently stands, and why it remains ongoing.',
}

export async function POST(req: NextRequest) {
  try {
    const { goalText, status, employeeName, role } = await req.json() as {
      goalText: string
      status: 'successful' | 'unsuccessful' | 'ongoing'
      employeeName?: string
      role?: string
    }

    if (!goalText?.trim() || !status) {
      return NextResponse.json({ error: 'goalText and status required' }, { status: 400 })
    }

    const systemPrompt = `You are an expert HR performance review writer. You write clear, professional, and specific explanations for goal outcomes in annual performance reviews. Your explanations are grounded in the goal's content and the stated outcome — not generic filler.`

    const userPrompt = `Write a 2–3 sentence explanation for the following performance review goal outcome.

Employee: ${employeeName?.trim() || 'the employee'} (${role?.trim() || 'their role'})
Goal / Objective: ${goalText.trim()}
Outcome: ${status.toUpperCase()}

${DIRECTION[status] ?? ''}

Use professional HR language. Be specific to the goal content. Do not start with "The employee". No bullets, numbers, quotes, or preamble. Return the explanation text only.`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    let explanation = ''

    // 1. Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const gemini = new OpenAI({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        })
        const res = await gemini.chat.completions.create({ model: 'gemini-2.0-flash', max_tokens: 250, messages })
        explanation = res.choices[0]?.message?.content?.trim() ?? ''
        if (explanation) return NextResponse.json({ explanation })
      } catch { /* fall through */ }
    }

    // 2. Anthropic Haiku
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 250,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        explanation = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
        if (explanation) return NextResponse.json({ explanation })
      } catch { /* fall through */ }
    }

    // 3. OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await openai.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 250, messages })
        explanation = res.choices[0]?.message?.content?.trim() ?? ''
        if (explanation) return NextResponse.json({ explanation })
      } catch { /* fall through */ }
    }

    return NextResponse.json({ error: 'No AI provider available or all providers failed' }, { status: 503 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
