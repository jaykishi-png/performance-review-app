import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

// GET ?token=UUID — get consent request details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data: recording, error } = await serviceClient
    .from('meeting_recordings')
    .select(`
      id, meeting_date, year, quarter, status,
      consent_manager, consent_employee, consent_declined,
      consent_manager_token, consent_employee_token,
      manager:profiles!meeting_recordings_manager_id_fkey(name),
      employee:profiles!meeting_recordings_employee_id_fkey(name)
    `)
    .or(`consent_manager_token.eq.${token},consent_employee_token.eq.${token}`)
    .single()

  if (error || !recording) {
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

  const { data: recording, error: fetchError } = await serviceClient
    .from('meeting_recordings')
    .select(`
      id, status, consent_manager, consent_employee, consent_declined,
      consent_manager_token, consent_employee_token,
      manager_id, employee_id,
      meeting_date,
      manager:profiles!meeting_recordings_manager_id_fkey(name, email),
      employee:profiles!meeting_recordings_employee_id_fkey(name, email)
    `)
    .or(`consent_manager_token.eq.${token},consent_employee_token.eq.${token}`)
    .single()

  if (fetchError || !recording) {
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
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'
    const buttonStyle = 'display:inline-block;padding:12px 24px;border-radius:6px;font-weight:600;text-decoration:none;font-size:15px;background:#4f46e5;color:#fff;'

    if (action === 'consent' && bothConsented) {
      // Notify both parties that consent is complete
      const notifyEmails = [
        { to: manager?.email, name: manager?.name },
        { to: employee?.email, name: employee?.name },
      ].filter((e) => e.to)

      for (const recipient of notifyEmails) {
        await resend.emails.send({
          from: fromEmail,
          to: recipient.to!,
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
      // Notify the other party that one has consented
      const otherEmail = tokenRole === 'manager' ? employee?.email : manager?.email
      const otherName = tokenRole === 'manager' ? employee?.name : manager?.name
      const consentorName = tokenRole === 'manager' ? manager?.name : employee?.name

      if (otherEmail) {
        await resend.emails.send({
          from: fromEmail,
          to: otherEmail,
          subject: `${consentorName} has consented to recording`,
          html: `
            <div style="background:#0f0f0f;color:#e5e5e5;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
              <h2 style="color:#fff;margin-top:0;">Waiting for your consent</h2>
              <p><strong>${consentorName}</strong> has consented to recording the 1:1 meeting on <strong>${formattedDate}</strong>.</p>
              <p>We're waiting for your response, ${otherName}.</p>
            </div>
          `,
        })
      }
    } else if (action === 'decline' && manager?.email) {
      // Notify manager that employee declined
      await resend.emails.send({
        from: fromEmail,
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
  }

  return NextResponse.json({ ok: true, status: newStatus, both_consented: bothConsented })
}
