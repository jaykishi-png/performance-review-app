import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('smtp_email, smtp_display_name, drive_folder_url, sa_drive_folder_url, org_name')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ smtp_email: null, smtp_display_name: 'Performance Review', drive_folder_url: null, sa_drive_folder_url: null, org_name: null })
  return NextResponse.json(data ?? { smtp_email: null, smtp_display_name: 'Performance Review', drive_folder_url: null, sa_drive_folder_url: null, org_name: null })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { smtp_email, smtp_password, smtp_display_name, drive_folder_url, sa_drive_folder_url, org_name } = body

  // Get existing row id
  const { data: existing } = await supabase.from('app_settings').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle()

  const payload: Record<string, string | null> = {
    smtp_display_name: smtp_display_name || 'Performance Review',
    updated_at: new Date().toISOString(),
  }
  if (smtp_email !== undefined) payload.smtp_email = smtp_email
  if (smtp_password) payload.smtp_password = smtp_password
  if (drive_folder_url !== undefined) payload.drive_folder_url = drive_folder_url
  if (sa_drive_folder_url !== undefined) payload.sa_drive_folder_url = sa_drive_folder_url
  if (org_name !== undefined) payload.org_name = org_name

  let error
  if (existing?.id) {
    ;({ error } = await supabase.from('app_settings').update(payload).eq('id', existing.id))
  } else {
    ;({ error } = await supabase.from('app_settings').insert(payload))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
