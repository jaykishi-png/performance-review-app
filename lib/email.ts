import nodemailer from 'nodemailer'
import { createServiceClient } from '@/lib/supabase/server'

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const supabase = createServiceClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('smtp_email, smtp_password, smtp_display_name')
    .single()

  // If Gmail SMTP is configured, use it
  if (settings?.smtp_email && settings?.smtp_password) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: settings.smtp_email,
        pass: settings.smtp_password,
      },
    })

    const from = `${settings.smtp_display_name || 'Performance Review'} <${settings.smtp_email}>`
    await transporter.sendMail({ from, to, subject, html })
    return { success: true, provider: 'gmail' }
  }

  // Fallback to Resend sandbox
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = 'Performance Review <onboarding@resend.dev>'
  const toArray = Array.isArray(to) ? to : [to]
  const result = await resend.emails.send({ from, to: toArray, subject, html })
  return { success: !result.error, provider: 'resend', error: result.error }
}
