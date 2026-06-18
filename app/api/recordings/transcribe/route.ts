import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const GOOGLE_SPEECH_API_KEY = process.env.GOOGLE_CLOUD_SPEECH_API_KEY

export async function POST(request: NextRequest) {
  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { recording_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { recording_id } = body

  if (!recording_id) {
    return NextResponse.json({ error: 'recording_id is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: recording, error: fetchError } = await serviceClient
    .from('meeting_recordings')
    .select('*')
    .eq('id', recording_id)
    .single()

  if (fetchError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (recording.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (recording.status !== 'recorded') {
    return NextResponse.json({ error: 'Recording must be in recorded status to transcribe' }, { status: 409 })
  }

  const filename = recording.recording_filename as string
  if (!filename) {
    return NextResponse.json({ error: 'No recording file found' }, { status: 400 })
  }

  if (!GOOGLE_SPEECH_API_KEY) {
    return NextResponse.json({ error: 'Google Cloud Speech API key not configured' }, { status: 500 })
  }

  // Download audio from Supabase Storage
  const { data: fileData, error: downloadError } = await serviceClient.storage
    .from('meeting-recordings')
    .download(filename)

  if (downloadError || !fileData) {
    return NextResponse.json({ error: downloadError?.message ?? 'Failed to download recording' }, { status: 500 })
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const audioBytes = Buffer.from(arrayBuffer).toString('base64')

  // --- Google Cloud Speech-to-Text (longrunningrecognize supports audio > 60 seconds) ---
  let transcript = ''

  try {
    // Start long-running recognition operation
    const startRes = await fetch(
      `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${GOOGLE_SPEECH_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            // WEBM_OPUS is recorded natively by browser MediaRecorder
            encoding: 'WEBM_OPUS',
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            model: 'latest_long',
            useEnhanced: true,
          },
          audio: {
            content: audioBytes,
          },
        }),
      }
    )

    if (!startRes.ok) {
      const errBody = await startRes.text()
      console.error('Google Speech start error:', errBody)
      return NextResponse.json({ error: `Google Speech API error: ${startRes.status}` }, { status: 500 })
    }

    const operation = await startRes.json() as { name: string }
    const opName = operation.name

    if (!opName) {
      return NextResponse.json({ error: 'Google Speech API did not return an operation name' }, { status: 500 })
    }

    // Poll for completion — up to 90 seconds (30 x 3s)
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const pollRes = await fetch(
        `https://speech.googleapis.com/v1/operations/${opName}?key=${GOOGLE_SPEECH_API_KEY}`
      )
      const opStatus = await pollRes.json() as {
        done?: boolean
        response?: { results?: { alternatives?: { transcript: string }[] }[] }
        error?: { message: string }
      }

      if (opStatus.error) {
        return NextResponse.json({ error: `Transcription failed: ${opStatus.error.message}` }, { status: 500 })
      }

      if (opStatus.done) {
        transcript = (opStatus.response?.results ?? [])
          .map(r => r.alternatives?.[0]?.transcript ?? '')
          .join(' ')
          .trim()
        break
      }
    }

    if (!transcript) {
      // Timed out — save partial state so user can see it processed
      await serviceClient
        .from('meeting_recordings')
        .update({ transcript_status: 'processing' })
        .eq('id', recording_id)
      return NextResponse.json({ error: 'Transcription is taking longer than expected. Please try again in a moment.' }, { status: 202 })
    }
  } catch (speechErr) {
    console.error('Google Speech error:', speechErr)
    return NextResponse.json({ error: 'Transcription service error' }, { status: 500 })
  }

  // Save transcript to DB
  await serviceClient
    .from('meeting_recordings')
    .update({ transcript, transcript_status: 'complete' })
    .eq('id', recording_id)

  // --- Summarize with GPT-4o ---
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `You are summarizing a 1:1 performance check-in meeting between a manager and employee.

Transcript:
${transcript}

Return a JSON object with:
- summary: 2-3 sentence overview of the meeting
- key_topics: array of strings (max 5 topics discussed)
- action_items: array of { owner: 'manager'|'employee'|'both', item: string, due_date?: string }
- sentiment: 'positive'|'neutral'|'needs_attention'

Return only valid JSON.`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  let parsed: {
    summary?: string
    key_topics?: string[]
    action_items?: { owner: string; item: string; due_date?: string }[]
    sentiment?: string
  } = {}

  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    // proceed with empty parsed — partial update still works
  }

  const { data: updated, error: finalUpdateError } = await serviceClient
    .from('meeting_recordings')
    .update({
      summary: parsed.summary ?? null,
      key_topics: parsed.key_topics ?? [],
      action_items: parsed.action_items ?? [],
      sentiment: parsed.sentiment ?? null,
      status: 'complete',
    })
    .eq('id', recording_id)
    .select()
    .single()

  if (finalUpdateError) {
    return NextResponse.json({ error: finalUpdateError.message }, { status: 500 })
  }

  return NextResponse.json({ data: updated })
}
