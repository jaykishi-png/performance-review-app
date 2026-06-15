import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

async function getAuthContext() {
  const userClient = await createClient()
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return { user: null, role: null, profile: null }

  const serviceClient = await createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()

  return { user, role: profile?.role ?? null, profile }
}

// GET ?employee_id=UUID or ?manager_id=UUID
export async function GET(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const employee_id = searchParams.get('employee_id')
  const manager_id = searchParams.get('manager_id')

  const serviceClient = await createServiceClient()
  const isPrivileged = role === 'admin' || role === 'dev_admin'

  let query = serviceClient
    .from('meeting_recordings')
    .select(`
      *,
      manager:profiles!meeting_recordings_manager_id_fkey(id, name, email),
      employee:profiles!meeting_recordings_employee_id_fkey(id, name, email)
    `)
    .order('meeting_date', { ascending: false })

  if (isPrivileged) {
    if (employee_id) query = query.eq('employee_id', employee_id)
    if (manager_id) query = query.eq('manager_id', manager_id)
  } else if (role === 'manager') {
    query = query.eq('manager_id', user.id)
    if (employee_id) query = query.eq('employee_id', employee_id)
  } else {
    // employee
    query = query.eq('employee_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST — create recording session + send consent emails
export async function POST(request: NextRequest) {
  const { user, role, profile: managerProfile } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { employee_id?: string; meeting_date?: string; year?: number; quarter?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { employee_id, meeting_date, year, quarter } = body

  if (!employee_id || !meeting_date || !year) {
    return NextResponse.json({ error: 'employee_id, meeting_date, and year are required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: employeeProfile, error: empError } = await serviceClient
    .from('profiles')
    .select('id, name, email')
    .eq('id', employee_id)
    .single()

  if (empError || !employeeProfile) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  const { data: recording, error: insertError } = await serviceClient
    .from('meeting_recordings')
    .insert({
      manager_id: user.id,
      employee_id,
      meeting_date,
      year,
      quarter: quarter ?? null,
      status: 'pending_consent',
    })
    .select()
    .single()

  if (insertError || !recording) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Send consent emails if Resend is configured
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const managerName = managerProfile?.name ?? 'Your manager'
    const employeeName = employeeProfile.name ?? 'the employee'
    const formattedDate = new Date(meeting_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const managerConsentUrl = `${appUrl}/consent/${recording.consent_manager_token}`
    const employeeConsentUrl = `${appUrl}/consent/${recording.consent_employee_token}`
    const employeeDeclineUrl = `${appUrl}/consent/${recording.consent_employee_token}?decline=true`

    const buttonStyle = 'display:inline-block;padding:12px 24px;border-radius:6px;font-weight:600;text-decoration:none;font-size:15px;'

    // Email to manager
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
      to: managerProfile?.email ?? user.email!,
      subject: `Recording consent needed — 1:1 with ${employeeName}`,
      html: `
        <div style="background:#0f0f0f;color:#e5e5e5;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
          <h2 style="color:#fff;margin-top:0;">Recording consent needed</h2>
          <p>You've requested to record your 1:1 meeting with <strong>${employeeName}</strong> on <strong>${formattedDate}</strong>.</p>
          <p>Please confirm your consent below. Both parties must consent before recording can begin.</p>
          <a href="${managerConsentUrl}" style="${buttonStyle}background:#4f46e5;color:#fff;">I Consent to Recording →</a>
        </div>
      `,
    })

    // Email to employee
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
      to: employeeProfile.email,
      subject: `${managerName} would like to record your 1:1 meeting`,
      html: `
        <div style="background:#0f0f0f;color:#e5e5e5;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
          <h2 style="color:#fff;margin-top:0;">Meeting recording request</h2>
          <p><strong>${managerName}</strong> has requested to record your upcoming 1:1 meeting on <strong>${formattedDate}</strong>.</p>
          <p>Recording will only begin if both parties consent. You can decline at any time.</p>
          <div style="margin-top:24px;display:flex;gap:12px;">
            <a href="${employeeConsentUrl}" style="${buttonStyle}background:#16a34a;color:#fff;margin-right:12px;">I Consent →</a>
            <a href="${employeeDeclineUrl}" style="${buttonStyle}background:#1a1a1a;color:#f87171;border:1px solid #f87171;">Decline</a>
          </div>
        </div>
      `,
    })
  }

  return NextResponse.json({ data: recording }, { status: 201 })
}

// PATCH — update recording (e.g. save note_id)
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; note_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, note_id } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: existing, error: fetchError } = await serviceClient
    .from('meeting_recordings')
    .select('manager_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (existing.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (note_id !== undefined) updates.note_id = note_id

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await serviceClient
    .from('meeting_recordings')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
