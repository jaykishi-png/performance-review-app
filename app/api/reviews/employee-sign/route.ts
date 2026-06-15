import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role, name, email')
      .eq('id', user.id)
      .single()
    const role = (profile as { role: string; name: string | null; email: string } | null)?.role ?? 'pending'
    if (role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { reviewId: string; employeeSignature: string }
    const { reviewId, employeeSignature } = body

    // Fetch review where id=reviewId AND employee_id=user.id
    const { data: review, error: fetchError } = await serviceClient
      .from('reviews')
      .select('id, employee_signed_at, employee_name, user_id')
      .eq('id', reviewId)
      .eq('employee_id', user.id)
      .single()
    if (fetchError || !review) {
      return NextResponse.json({ error: 'Review not found or not yours' }, { status: 403 })
    }

    const reviewRow = review as { id: string; employee_signed_at: string | null; employee_name: string | null; user_id: string }
    if (reviewRow.employee_signed_at) {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error: updateError } = await serviceClient
      .from('reviews')
      .update({ employee_signed_at: now, employee_signature: employeeSignature })
      .eq('id', reviewId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const employeeName = reviewRow.employee_name ||
      (profile as { name: string | null; email: string } | null)?.name ||
      (profile as { name: string | null; email: string } | null)?.email || 'Employee'

    // Fetch manager name for the notification body
    const { data: managerProfile } = await serviceClient
      .from('profiles')
      .select('name, email')
      .eq('id', reviewRow.user_id)
      .single()
    const managerName = (managerProfile as { name: string | null; email: string } | null)?.name ||
      (managerProfile as { name: string | null; email: string } | null)?.email || 'Manager'

    // Notify admin
    const { data: adminProfile } = await serviceClient
      .from('profiles')
      .select('id, email')
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (adminProfile) {
      const admin = adminProfile as { id: string; email: string }
      await serviceClient
        .from('notifications')
        .insert({
          user_id: admin.id,
          type: 'review_signed',
          title: `1:1 Complete: ${employeeName}`,
          body: `Both ${employeeName} and ${managerName} have signed the performance review.`,
          reference_id: reviewId,
        })

      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'Performance Review <reviews@innosupps.com>',
          to: 'videoteam@rushmediateam.com',
          subject: `Performance Review Fully Signed — ${employeeName}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#13151f;border:1px solid #1e2130;border-radius:16px;padding:36px 32px;">
      <div style="font-size:28px;margin-bottom:16px;">✅</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f2fa;">Performance Review Fully Executed</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.6;">
        The performance review for <strong style="color:#f0f2fa;">${employeeName}</strong> has been signed by both parties.
      </p>
      <div style="background:#0d2b1f;border:1px solid #1a4a35;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#34d399;font-weight:600;">
        ✓ ${managerName} (Manager) &nbsp;&nbsp; ✓ ${employeeName} (Employee)
      </div>
      <p style="margin:0;font-size:12px;color:#4b5563;">This review is now fully executed and archived.</p>
    </div>
  </div>
</body>
</html>`,
        }).catch(() => { /* non-critical */ })
      }
    }

    return NextResponse.json({ ok: true, signedAt: now })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
