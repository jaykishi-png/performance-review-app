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
    if (role !== 'manager' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { reviewId: string; employeeSignature: string }
    const { reviewId, employeeSignature } = body

    if (!reviewId || !employeeSignature?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find the review belonging to this manager
    const { data: review, error: fetchError } = await serviceClient
      .from('reviews')
      .select('id, employee_id, employee_name, drive_url')
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .single()
    if (fetchError || !review) {
      return NextResponse.json({ error: 'Review not found or not yours' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error: updateError } = await serviceClient
      .from('reviews')
      .update({ employee_signed_at: now, employee_signature: employeeSignature.trim() })
      .eq('id', reviewId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const reviewRow = review as { id: string; employee_id: string | null; employee_name: string | null; drive_url: string | null }
    const managerName = (profile as { name: string | null; email: string } | null)?.name ||
      (profile as { name: string | null; email: string } | null)?.email || 'Manager'
    const employeeName = reviewRow.employee_name || 'the employee'

    // Send notification to admin in notifications table
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
          body: `${managerName} has recorded the in-person signature for ${employeeName}'s performance review during the 1:1 meeting.`,
          reference_id: reviewId,
        })

      // Send email to admin
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        await resend.emails.send({
          from: 'Performance Review <reviews@innosupps.com>',
          to: 'videoteam@rushmediateam.com',
          subject: `1:1 Meeting Complete — ${employeeName} signed`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#13151f;border:1px solid #1e2130;border-radius:16px;padding:36px 32px;">
      <div style="font-size:28px;margin-bottom:16px;">✍️</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f2fa;">1:1 Meeting Complete</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.6;">
        <strong style="color:#f0f2fa;">${managerName}</strong> has recorded the employee signature for <strong style="color:#f0f2fa;">${employeeName}</strong>'s performance review during their 1:1 meeting.
      </p>
      <div style="background:#0d1117;border:1px solid #2a2d3a;border-radius:10px;padding:16px;margin-bottom:20px;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">REVIEW DETAILS</div>
        <div style="font-size:13px;color:#e5e7eb;">Manager: ${managerName}</div>
        <div style="font-size:13px;color:#e5e7eb;margin-top:4px;">Employee: ${employeeName}</div>
        <div style="font-size:13px;color:#e5e7eb;margin-top:4px;">Date Signed: ${dateStr}</div>
        ${reviewRow.drive_url ? `<div style="font-size:13px;margin-top:4px;"><a href="${reviewRow.drive_url}" style="color:#34d399;">View Google Doc →</a></div>` : ''}
      </div>
      <p style="margin:0;font-size:12px;color:#4b5563;">Both the manager and employee have now signed this performance review.</p>
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
