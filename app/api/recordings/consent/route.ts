import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET ?token=UUID — get consent request details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: recordings, error } = await serviceClient
    .from('meeting_recordings')
    .select(`
      id, meeting_date, year, quarter, status,
      consent_manager, consent_employee, consent_declined,
      consent_manager_token, consent_employee_token,
      manager:profiles!manager_id(name),
      employee:profiles!employee_id(name)
    `)
    .or(`consent_manager_token.eq.${token},consent_employee_token.eq.${token}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[consent GET] db error:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const recording = recordings?.[0] ?? null
  if (!recording) {
    console.error('[consent GET] no recording found for token:', token)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token_role = recording.consent_manager_token === token ? 'manager' : 'employee'

  return NextResponse.json({
    recording_id: recording.id,
    manager_name: ((recording.manager as unknown as { name: string }[] | null)?.[0]?.name ?? (recording.manager as unknown as { name: string } | null)?.name) ?? null,
    employee_name: ((recording.employee as unknown as { name: string }[] | null)?.[0]?.name ?? (recording.employee as unknown as { name: string } | null)?.name) ?? null,
    meeting_date: recording.meeting_date,
    year: recording.year,
    token_role,
    status: recording.status,
    consent_manager: recording.consent_manager,
    consent_employee: recording.consent_employee,
    consent_declined: recording.consent_declined,
  })
}

// POST — submit consent or decline
export async function POST(request: NextRequest) {
  let body: { token?: string; action?: 'consent' | 'decline' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token, action } = body

  if (!token || !action) {
    return NextResponse.json({ error: 'token and action are required' }, { status: 400 })
  }

  if (action !== 'consent' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be consent or decline' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: rows, error: fetchError } = await serviceClient
    .from('meeting_recordings')
    .select(`
      id, status, consent_manager, consent_employee, consent_declined,
      consent_manager_token, consent_employee_token,
      manager_id, employee_id,
      meeting_date,
      manager:profiles!manager_id(name, email),
      employee:profiles!employee_id(name, email)
    `)
    .or(`consent_manager_token.eq.${token},consent_employee_token.eq.${token}`)
    .order('created_at', { ascending: false })

  const recording = fetchError ? null : (rows?.[0] ?? null)
  if (!recording) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (recording.status === 'declined') {
    return NextResponse.json({ error: 'This consent request has already been declined' }, { status: 409 })
  }

  const tokenRole = recording.consent_manager_token === token ? 'manager' : 'employee'
  const _mgr = recording.manager as unknown
  const _emp = recording.employee as unknown
  const manager = (Array.isArray(_mgr) ? _mgr[0] : _mgr) as { name: string; email: string } | null
  const employee = (Array.isArray(_emp) ? _emp[0] : _emp) as { name: string; email: string } | null
  const formattedDate = new Date(recording.meeting_date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const updates: Record<string, unknown> = {}
  let newStatus = recording.status

  if (action === 'consent') {
    if (tokenRole === 'manager') {
      updates.consent_manager = true
      updates.consent_manager_at = new Date().toISOString()
    } else {
      updates.consent_employee = true
      updates.consent_employee_at = new Date().toISOString()
    }

    const managerConsented = tokenRole === 'manager' ? true : recording.consent_manager
    const employeeConsented = tokenRole === 'employee' ? true : recording.consent_employee

    if (managerConsented && employeeConsented) {
      newStatus = 'consented'
      updates.status = 'consented'
    }
  } else {
    updates.consent_declined = true
    updates.declined_by = tokenRole
    updates.status = 'declined'
    newStatus = 'declined'
  }

  const { error: updateError } = await serviceClient
    .from('meeting_recordings')
    .update(updates)
    .eq('id', recording.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const bothConsented = newStatus === 'consented'

  // Send notification emails
  try {
    if (action === 'consent' && bothConsented) {
      const recipients = [manager?.email, employee?.email].filter(Boolean) as string[]
      for (const to of recipients) {
        await sendEmail({
          to,
          subject: 'Both parties have consented — recording may proceed',
          html: `
            <div style="background:#0f0f0f;color:#e5e5e5;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
              <h2 style="color:#fff;margin-top:0;">Consent complete</h2>
              <p>Both <strong>${manager?.name}</strong> and <strong>${employee?.name}</strong> have consented to recording their 1:1 meeting on <strong>${formattedDate}</strong>.</p>
              <p>The meeting may now be recorded.</p>
            </div>
          `,
        })
      }
    } else if (action === 'consent') {
      const otherEmail = tokenRole === 'manager' ? employee?.email : manager?.email
      const otherName = tokenRole === 'manager' ? employee?.name : manager?.name
      const consentorName = tokenRole === 'manager' ? manager?.name : employee?.name
      if (otherEmail) {
        await sendEmail({
          to: otherEmail,
          subject: `${consentorName} has consented to recording`,
          html: `
            <div style="background:#0f0f0f;color:#e5e5e5;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
              <h2 style="color:#fff;margin-top:0;">Waiting for your consent</h2>
              <p><strong>${consentorName}</strong> has consented to recording the 1:1 meeting on <strong>${formattedDate}</strong>.</p>
              <p>Please click your consent link to proceed, ${otherName}.</p>
            </div>
          `,
        })
      }
    } else if (action === 'decline' && manager?.email) {
      await sendEmail({
        to: manager.email,
        subject: `${employee?.name} declined recording consent`,
        html: `
          <div style="background:#0f0f0f;color:#e5e5e5;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
            <h2 style="color:#fff;margin-top:0;">Recording declined</h2>
            <p><strong>${employee?.name}</strong> has declined consent to record your 1:1 meeting on <strong>${formattedDate}</strong>.</p>
            <p>The meeting will not be recorded.</p>
          </div>
        `,
      })
    }
  } catch (err) {
    console.error('[consent] notification email failed:', err)
  }

  return NextResponse.json({ ok: true, status: newStatus, both_consented: bothConsented })
}
