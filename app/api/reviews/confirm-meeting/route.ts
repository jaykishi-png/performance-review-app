import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: profile } = await svc.from('profiles').select('role, name, email').eq('id', user.id).single()
    const p = profile as { role: string; name: string | null; email: string } | null
    const role = p?.role ?? 'pending'

    if (role !== 'manager' && role !== 'middle_manager' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { reviewId, resend } = await req.json() as { reviewId: string; resend?: boolean }
    if (!reviewId) return NextResponse.json({ error: 'Missing reviewId' }, { status: 400 })

    // Verify this review belongs to the calling manager
    const { data: review, error: fetchErr } = await svc
      .from('reviews')
      .select('id, employee_id, employee_name, meeting_confirmed_at')
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .single()
    if (fetchErr || !review) {
      return NextResponse.json({ error: 'Review not found or not yours' }, { status: 403 })
    }

    const rv = review as { id: string; employee_id: string | null; employee_name: string | null; meeting_confirmed_at: string | null }
    // If already confirmed and not a resend request, return early (idempotent)
    if (rv.meeting_confirmed_at && !resend) {
      return NextResponse.json({ ok: true, confirmedAt: rv.meeting_confirmed_at })
    }

    let confirmedAt = rv.meeting_confirmed_at
    if (!confirmedAt) {
      const now = new Date().toISOString()
      const { error: updateErr } = await svc.from('reviews').update({ meeting_confirmed_at: now }).eq('id', reviewId)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
      confirmedAt = now
    }

    // Send signing invitation emails — use request origin so the link always
    // points to the same domain the manager is on (avoids cross-domain cookie issues)
    const origin = new URL(req.url).origin
    const signUrl = `${origin}/sign/${reviewId}`
    const managerName = p?.name || p?.email || 'Manager'
    const employeeName = rv.employee_name || 'Employee'

    try {
      const { sendEmail } = await import('@/lib/email')

      // Email to manager
      const managerEmail = p?.email
      if (managerEmail) {
        await sendEmail({
          to: managerEmail,
          subject: `Please sign ${employeeName}'s performance review`,
          html: buildSigningEmail({
            recipientName: managerName,
            employeeName,
            managerName,
            role: 'manager',
            signUrl,
          }),
        })
      }

      // Email to employee
      if (rv.employee_id) {
        const { data: empProfile } = await svc.from('profiles').select('name, email').eq('id', rv.employee_id).single()
        const emp = empProfile as { name: string | null; email: string } | null
        if (emp?.email) {
          await sendEmail({
            to: emp.email,
            subject: `Your performance review with ${managerName} is ready for your signature`,
            html: buildSigningEmail({
              recipientName: emp.name || emp.email,
              employeeName,
              managerName,
              role: 'employee',
              signUrl,
            }),
          })
        }
      }
    } catch { /* email is non-critical */ }

    return NextResponse.json({ ok: true, confirmedAt: confirmedAt })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function buildSigningEmail({ recipientName, employeeName, managerName, role, signUrl }: {
  recipientName: string
  employeeName: string
  managerName: string
  role: 'manager' | 'employee'
  signUrl: string
}) {
  const year = new Date().getFullYear()
  const headline = role === 'manager'
    ? `Please sign ${employeeName}'s ${year} Performance Review`
    : `Your ${year} Performance Review is ready to sign`
  const body = role === 'manager'
    ? `${managerName}, the performance review meeting with <strong style="color:#f0f2fa;">${employeeName}</strong> has been confirmed. Please click below to view the full review and add your signature.`
    : `${managerName} has confirmed your performance review meeting. Please click below to view the full review and sign to acknowledge.`
  const buttonText = role === 'manager' ? 'View &amp; Sign Review' : 'View &amp; Sign Your Review'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#13151f;border:1px solid #1e2130;border-radius:16px;padding:36px 32px;">
      <div style="font-size:28px;margin-bottom:16px;">📋</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f2fa;">${headline}</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;line-height:1.6;">
        Hi ${recipientName}, ${body}
      </p>
      <a href="${signUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
        ${buttonText}
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#4b5563;line-height:1.5;">
        If you have any questions, please reach out to your manager directly.
      </p>
    </div>
  </div>
</body>
</html>`
}
