import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const recording_id = formData.get('recording_id') as string | null
  const audioFile = formData.get('audio') as File | null

  if (!recording_id || !audioFile) {
    return NextResponse.json({ error: 'recording_id and audio file are required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: recording, error: fetchError } = await serviceClient
    .from('meeting_recordings')
    .select('id, manager_id, status')
    .eq('id', recording_id)
    .single()

  if (fetchError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (recording.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (recording.status !== 'consented') {
    return NextResponse.json({ error: 'Recording cannot be uploaded until both parties have consented' }, { status: 409 })
  }

  const audioBuffer = await audioFile.arrayBuffer()
  const filePath = `${user.id}/${recording_id}.webm`

  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from('meeting-recordings')
    .upload(filePath, audioBuffer, { contentType: 'audio/webm', upsert: true })

  if (uploadError || !uploadData) {
    return NextResponse.json({ error: uploadError?.message ?? 'Upload failed' }, { status: 500 })
  }

  const { data: urlData } = serviceClient.storage
    .from('meeting-recordings')
    .getPublicUrl(filePath)

  const recording_url = urlData?.publicUrl ?? filePath

  const { error: updateError } = await serviceClient
    .from('meeting_recordings')
    .update({
      recording_url,
      recording_filename: filePath,
      status: 'recorded',
    })
    .eq('id', recording_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recording_url })
}
