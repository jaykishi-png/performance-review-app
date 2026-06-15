import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
  'https://performance-review-app-three.vercel.app'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles').select('role, name').eq('id', user.id).single()

  if ((profile as { role: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role, managerId, position, startDate } = await request.json()
  if (!email || !role) return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })

  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const inviterName = (profile as { name: string | null } | null)?.name || user.email || 'Your Admin'

  // Upsert invite (replace any existing pending invite for this email)
  const { error: inviteError } = await serviceClient.from('invites').upsert({
    email,
    role,
    invited_by: user.id,
    manager_id: managerId || null,
    position: position || null,
    start_date: startDate || null,
    token,
    expires_at: expiresAt,
    accepted_at: null,
  }, { onConflict: 'email' })

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  // Audit log
  await serviceClient.from('audit_logs').insert({
    actor_user_id: user.id,
    action: 'invite.create',
    target_type: 'invite',
    target_id: email,
    metadata: { role, email, managerId },
  })

  const inviteLink = `${APP_URL}/login?invite=${token}`

  // Resolve manager name if provided
  let managerName = ''
  if (managerId) {
    const { data: mgr } = await serviceClient
      .from('profiles').select('name, email').eq('id', managerId).single()
    managerName = (mgr as { name: string | null; email: string } | null)?.name ||
      (mgr as { name: string | null; email: string } | null)?.email || ''
  }

  // Send email via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const roleLabel = role === 'admin' ? 'Administrator' : role === 'manager' ? 'Manager' : 'Employee'

      await resend.emails.send({
        from: 'Performance Review <reviews@innosupps.com>',
        to: email,
        subject: `You've been invited to Performance Review`,
        html: buildInviteEmail({ email, role: roleLabel, inviterName, managerName, inviteLink }),
      })
    } catch (err) {
      console.error('[invite] email send failed:', err)
      // Still return success — invite record created, link available as fallback
    }
  }

  return NextResponse.json({ inviteLink, emailSent: !!process.env.RESEND_API_KEY })
}

function buildInviteEmail({ email, role, inviterName, managerName, inviteLink }: {
  email: string; role: string; inviterName: string; managerName: string; inviteLink: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f0f2fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d14;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#13151f;border:1px solid #1e2130;border-radius:16px;overflow:hidden;max-width:540px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2130;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;font-size:20px;">📋</td>
              <td style="padding-left:12px;font-size:18px;font-weight:700;color:#f0f2fa;">Performance Review</td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f0f2fa;letter-spacing:-0.3px;">
            You&apos;ve been invited
          </h1>
          <p style="margin:0 0 20px;font-size:15px;color:#9ca3af;line-height:1.6;">
            <strong style="color:#c4c9d4;">${inviterName}</strong> has invited you to join the Performance Review platform as a <strong style="color:#c4c9d4;">${role}</strong>.
          </p>
          ${managerName ? `<p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.6;">You&apos;ll be reporting to <strong style="color:#c4c9d4;">${managerName}</strong>.</p>` : ''}

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;">
              <a href="${inviteLink}" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;text-align:center;">
                Accept Invitation →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;line-height:1.6;">
            Sign in with your Google account at <strong style="color:#c4c9d4;">${email}</strong>. This invitation expires in 7 days.
          </p>
          <p style="margin:0;font-size:11px;color:#374151;line-height:1.6;">
            If the button doesn't work, copy and paste this link:<br>
            <span style="color:#4f46e5;">${inviteLink}</span>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #1e2130;text-align:center;">
          <p style="margin:0;font-size:11px;color:#374151;">Performance Review · Sent by ${inviterName}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
