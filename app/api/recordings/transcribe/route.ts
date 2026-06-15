import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Download audio from Supabase Storage
  const { data: fileData, error: downloadError } = await serviceClient.storage
    .from('meeting-recordings')
    .download(filename)

  if (downloadError || !fileData) {
    return NextResponse.json({ error: downloadError?.message ?? 'Failed to download recording' }, { status: 500 })
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const file = new File([arrayBuffer], 'recording.webm', { type: 'audio/webm' })

  // Transcribe with Whisper
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
  })

  const transcript = transcription as unknown as string

  await serviceClient
    .from('meeting_recordings')
    .update({ transcript, transcript_status: 'complete' })
    .eq('id', recording_id)

  // Summarize with GPT-4o
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
