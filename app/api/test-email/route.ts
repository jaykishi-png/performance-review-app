import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to } = await req.json()
  if (!to) return NextResponse.json({ error: 'Missing to' }, { status: 400 })

  try {
    const result = await sendEmail({
      to,
      subject: 'Performance Review — Email Test',
      html: `<div style="font-family:sans-serif;padding:32px;background:#0f0f0f;color:#e5e5e5;border-radius:12px;max-width:500px;margin:0 auto;">
        <h2 style="color:#fff;margin-top:0;">✅ Email is working!</h2>
        <p>This is a test email from your Performance Review app.</p>
        <p style="color:#6b7280;font-size:13px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    })
    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('[test-email] failed:', err)
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}
