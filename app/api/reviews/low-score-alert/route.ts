import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      referenceId: string       // reviewId or selfReviewId
      employeeName: string
      score: number
      type: 'manager_review' | 'self_assessment'
    }
    const { referenceId, employeeName, score, type } = body
    if (!referenceId || !score || score > 2) return NextResponse.json({ ok: true, skipped: true })

    const svc = createServiceClient()

    // Fetch admin
    const { data: adminRow } = await svc
      .from('profiles')
      .select('id, email')
      .eq('role', 'admin')
      .limit(1)
      .single()
    if (!adminRow) return NextResponse.json({ ok: true, skipped: true })
    const admin = adminRow as { id: string; email: string }

    const notifType = type === 'self_assessment' ? 'low_score_sa' : 'low_score_review'
    const title = type === 'self_assessment'
      ? `Low Self-Assessment Score: ${employeeName}`
      : `Low Review Score: ${employeeName}`
    const bodyText = `${employeeName} received a ${score}★ score on their ${type === 'self_assessment' ? 'self-assessment' : 'performance review'}. Please review.`

    // Dedup: only insert if no notification of this type for this reference already exists
    const { data: existing } = await svc
      .from('notifications')
      .select('id')
      .eq('user_id', admin.id)
      .eq('type', notifType)
      .eq('reference_id', referenceId)
      .limit(1)
      .maybeSingle()

    if (!existing) {
      await svc.from('notifications').insert({
        user_id: admin.id,
        type: notifType,
        title,
        body: bodyText,
        reference_id: referenceId,
      })

      try {
        const { sendEmail } = await import('@/lib/email')
        const APP_URL = getAppUrl()
        await sendEmail({
          to: admin.email,
          subject: `⚠️ ${title}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#13151f;border:1px solid #1e2130;border-radius:16px;padding:36px 32px;">
      <div style="font-size:28px;margin-bottom:16px;">⚠️</div>
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${title}</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.6;">${bodyText}</p>
      <div style="background:#1f1a0d;border:1px solid #92400e;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
        <span style="color:#f59e0b;font-size:22px;">${'★'.repeat(score)}${'☆'.repeat(5 - score)}</span>
        <span style="color:#f59e0b;font-size:14px;font-weight:700;margin-left:8px;">${score}/5</span>
      </div>
      <a href="${APP_URL}/admin" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
        Review in Admin Portal →
      </a>
    </div>
  </div>
</body>
</html>`,
        })
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ ok: true, notified: !existing })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
