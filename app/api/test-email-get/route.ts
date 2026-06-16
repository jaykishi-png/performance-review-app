import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sendEmail({
      to: 'videoteam@rushmediateam.com',
      subject: 'Performance Review — Email Test',
      html: `<div style="font-family:sans-serif;padding:32px;background:#0f0f0f;color:#e5e5e5;border-radius:12px;max-width:500px;margin:0 auto;">
        <h2 style="color:#fff;margin-top:0;">✅ Email is working!</h2>
        <p>This is a test email from your Performance Review app.</p>
        <p style="color:#6b7280;font-size:13px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    })
    return NextResponse.json({ success: true, result, message: 'Test email sent to videoteam@rushmediateam.com' })
  } catch (err: any) {
    console.error('[test-email-get] failed:', err)
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}
