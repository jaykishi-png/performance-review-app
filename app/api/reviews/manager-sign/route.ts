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
    if (role !== 'manager' && role !== 'middle_manager' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { reviewId: string; managerSignature: string }
    const { reviewId, managerSignature } = body

    // Verify review belongs to this manager
    const { data: review, error: fetchError } = await serviceClient
      .from('reviews')
      .select('id, employee_id')
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .single()
    if (fetchError || !review) {
      return NextResponse.json({ error: 'Review not found or not yours' }, { status: 403 })
    }

    const now = new Date().toISOString()

    // Update review with signature
    const { error: updateError } = await serviceClient
      .from('reviews')
      .update({ manager_signed_at: now, manager_signature: managerSignature })
      .eq('id', reviewId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Try to send notification email to employee
    const employeeId = (review as { id: string; employee_id: string | null }).employee_id
    if (employeeId) {
      const { data: empProfile } = await serviceClient
        .from('profiles')
        .select('email, name')
        .eq('id', employeeId)
        .single()
      const empEmail = (empProfile as { email: string; name: string | null } | null)?.email

      if (empEmail) {
        const managerName = (profile as { name: string | null; email: string }).name ||
          (profile as { name: string | null; email: string }).email
        const currentYear = new Date().getFullYear()
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
          'https://performance-review-app-three.vercel.app'

        try {
        const { sendEmail } = await import('@/lib/email')
        await sendEmail({
          to: empEmail,
          subject: 'Your Performance Review is ready to sign',
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#13151f;border:1px solid #1e2130;border-radius:16px;padding:36px 32px;">
      <div style="font-size:28px;margin-bottom:16px;">📋</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f2fa;">${currentYear} Performance Review</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;line-height:1.6;">
        ${managerName} has completed your ${currentYear} performance review and confirmed your 1:1 meeting.
        Please log in to sign and acknowledge your review.
      </p>
      <a href="${APP_URL}/employee" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
        View &amp; Sign Your Review
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#4b5563;line-height:1.5;">
        If you have any questions, please reach out to your manager directly.
      </p>
    </div>
  </div>
</body>
</html>`,
        })
        } catch { /* non-critical */ }
      }
    }

    return NextResponse.json({ ok: true, signedAt: now })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
