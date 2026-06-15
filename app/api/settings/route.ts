import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('smtp_email, smtp_display_name')
    .single()

  if (error) return NextResponse.json({ smtp_email: null, smtp_display_name: 'Performance Review' })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { smtp_email, smtp_password, smtp_display_name } = body

  // Get existing row id
  const { data: existing } = await supabase.from('app_settings').select('id').single()

  const payload: Record<string, string> = {
    smtp_display_name: smtp_display_name || 'Performance Review',
    updated_at: new Date().toISOString(),
  }
  if (smtp_email !== undefined) payload.smtp_email = smtp_email
  if (smtp_password) payload.smtp_password = smtp_password // only update if provided

  let error
  if (existing?.id) {
    ;({ error } = await supabase.from('app_settings').update(payload).eq('id', existing.id))
  } else {
    ;({ error } = await supabase.from('app_settings').insert(payload))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
