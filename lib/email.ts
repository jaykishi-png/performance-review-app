import nodemailer from 'nodemailer'
import { createServiceClient } from '@/lib/supabase/server'

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const supabase = createServiceClient()
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('smtp_email, smtp_password, smtp_display_name')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('[email] settings loaded:', { smtp_email: settings?.smtp_email, has_password: !!settings?.smtp_password, settingsError })

  // If Gmail SMTP is configured, use it
  if (settings?.smtp_email && settings?.smtp_password) {
    console.log('[email] using Gmail SMTP:', settings.smtp_email, '→', to)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: settings.smtp_email,
        pass: settings.smtp_password,
      },
    })

    const from = `${settings.smtp_display_name || 'Performance Review'} <${settings.smtp_email}>`
    try {
      const result = await transporter.sendMail({ from, to, subject, html })
      console.log('[email] Gmail sent OK:', result.messageId)
      return { success: true, provider: 'gmail' }
    } catch (err) {
      console.error('[email] Gmail send failed:', err)
      throw err
    }
  }

  console.log('[email] no Gmail config, falling back to Resend sandbox')
  // Fallback to Resend sandbox
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = 'Performance Review <onboarding@resend.dev>'
  const toArray = Array.isArray(to) ? to : [to]
  const result = await resend.emails.send({ from, to: toArray, subject, html })
  console.log('[email] Resend result:', result)
  return { success: !result.error, provider: 'resend', error: result.error }
}
