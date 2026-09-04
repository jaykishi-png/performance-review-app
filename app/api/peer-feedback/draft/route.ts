import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const maxDuration = 30

type Field = 'q1_strengths' | 'q2_improvements' | 'q3_collab_text' | 'additional_comments'

const FIELD_BRIEF: Record<Field, { label: string; direction: string; shape: string }> = {
  q1_strengths: {
    label: 'greatest strengths',
    direction:
      'STRENGTHS — describe what this person does well. Name the specific behaviour, how consistently it shows up, and the effect it has on colleagues or the work.',
    shape: '2–3 sentences',
  },
  q2_improvements: {
    label: 'one area to improve',
    direction:
      'AREA FOR GROWTH — name one specific, changeable behaviour. Describe what was observed and the effect it had, then point at what doing it differently would look like. Constructive and respectful, never personal.',
    shape: '2–3 sentences',
  },
  q3_collab_text: {
    label: 'collaboration and communication',
    direction:
      'COLLABORATION AND COMMUNICATION — describe how this person works with others: how they share information, respond to input, and behave in group settings. Ground it in observed interactions.',
    shape: '2–3 sentences',
  },
  additional_comments: {
    label: 'anything else worth sharing',
    direction:
      'ADDITIONAL CONTEXT — anything relevant that the earlier questions did not cover. Keep it useful to the person being reviewed.',
    shape: '1–3 sentences',
  },
}

export async function POST(req: NextRequest) {
  try {
    const { token, field, context } = (await req.json()) as {
      token?: string
      field?: Field
      context?: string
    }

    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })
    if (!field || !FIELD_BRIEF[field]) {
      return NextResponse.json({ error: 'a valid field is required' }, { status: 400 })
    }
    if (!context?.trim()) {
      return NextResponse.json({ error: 'Add a few notes first' }, { status: 400 })
    }

    // The feedback form is public, so the token is what stands between this and
    // an open text-generation endpoint. Only draft for a request that exists and
    // is still awaiting a response.
    const svc = createServiceClient()
    const { data: request, error: requestError } = await svc
      .from('feedback_requests')
      .select('id, status, requestor_id')
      .eq('token', token)
      .maybeSingle()

    if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 })
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const r = request as { id: string; status: string; requestor_id: string }
    if (r.status === 'submitted') {
      return NextResponse.json({ error: 'This feedback has already been submitted' }, { status: 409 })
    }

    const { data: profile } = await svc
      .from('profiles')
      .select('name, email')
      .eq('id', r.requestor_id)
      .maybeSingle()
    const p = profile as { name: string | null; email: string } | null
    const fullName = p?.name?.trim() || ''
    const subject = fullName ? fullName.split(/\s+/)[0] : 'this person'

    const brief = FIELD_BRIEF[field]

    const systemPrompt =
      'You help a reviewer turn rough notes into clear, professional 360-degree peer feedback. ' +
      'You are writing in the reviewer\'s voice about a colleague, so use third person and the colleague\'s first name — never "I am" as the subject of the feedback, and never second person. ' +
      'Expand the notes into specific, credible observations. Never invent incidents, numbers, dates, or outcomes that the notes do not contain: if the notes are thin, stay general rather than fabricating detail. ' +
      'Keep the tone measured and constructive, the kind of thing that is useful to read about yourself.'

    const userPrompt = `PERSON BEING REVIEWED: ${subject}
QUESTION: ${brief.label}
DIRECTION: ${brief.direction}

MY ROUGH NOTES:
"""
${context.trim()}
"""

Turn my notes into polished peer feedback answering the question about ${subject}.

Output rules:
- ${brief.shape}
- Third person, referring to ${subject} by name
- Grounded strictly in my notes — add professional phrasing, not new facts
- No bullets, numbers, quotes, headings, or preamble
- Return the feedback text only`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    const providerErrors: string[] = []

    // 1. Gemini Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const gemini = new OpenAI({
          apiKey: process.env.GEMINI_API_KEY,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        })
        const res = await gemini.chat.completions.create({
          model: 'gemini-2.0-flash',
          max_tokens: 250,
          messages,
        })
        const draft = res.choices[0]?.message?.content?.trim() ?? ''
        if (draft) return NextResponse.json({ draft })
        providerErrors.push('Gemini: empty response')
      } catch (e) {
        providerErrors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      providerErrors.push('Gemini: no API key')
    }

    // 2. Claude Haiku
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 250,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        const draft = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('')
          .trim()
        if (draft) return NextResponse.json({ draft })
        providerErrors.push('Anthropic: empty response')
      } catch (e) {
        providerErrors.push(`Anthropic: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      providerErrors.push('Anthropic: no API key')
    }

    // 3. OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 250,
          temperature: 0.7,
          messages,
        })
        const draft = res.choices[0]?.message?.content?.trim() ?? ''
        if (draft) return NextResponse.json({ draft })
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
