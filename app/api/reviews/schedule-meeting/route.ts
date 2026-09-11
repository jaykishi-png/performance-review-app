import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/** Reject obvious typos — a mistyped year silently breaks every downstream display. */
const MAX_YEARS_AHEAD = 2

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

    const { reviewId, scheduledAt, location, notify } = await req.json() as {
      reviewId: string; scheduledAt: string; location?: string; notify?: boolean
    }
    if (!reviewId) return NextResponse.json({ error: 'Missing reviewId' }, { status: 400 })
    if (!scheduledAt) return NextResponse.json({ error: 'Missing scheduledAt' }, { status: 400 })

    const when = new Date(scheduledAt)
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Invalid meeting date' }, { status: 400 })
    }
    const maxAhead = new Date()
    maxAhead.setFullYear(maxAhead.getFullYear() + MAX_YEARS_AHEAD)
    if (when > maxAhead) {
      return NextResponse.json({ error: `That date is more than ${MAX_YEARS_AHEAD} years away — check the year.` }, { status: 400 })
    }

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

    // Rescheduling a meeting that has already happened is always a mistake
    if (rv.meeting_confirmed_at) {
      return NextResponse.json({ error: 'This meeting is already confirmed' }, { status: 400 })
    }

    const trimmedLocation = (location ?? '').trim()
    const { error: updateErr } = await svc
      .from('reviews')
      .update({
        meeting_scheduled_at: when.toISOString(),
        meeting_location: trimmedLocation || null,
      })
      .eq('id', reviewId)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    if (notify !== false && rv.employee_id) {
      // Email is non-critical — scheduling must succeed even when SMTP fails
      try {
        const { data: empProfile } = await svc.from('profiles').select('name, email').eq('id', rv.employee_id).single()
        const emp = empProfile as { name: string | null; email: string } | null
        if (emp?.email) {
          const { sendEmail } = await import('@/lib/email')
          const managerName = p?.name || p?.email || 'Your manager'
          const origin = new URL(req.url).origin
          await Promise.race([
            sendEmail({
              to: emp.email,
              subject: `Your performance review meeting with ${managerName} is scheduled`,
              html: buildScheduleEmail({
                recipientName: emp.name || emp.email,
                managerName,
                when,
                location: trimmedLocation,
                portalUrl: `${origin}/employee?page=reviews`,
              }),
            }),
            // Respond before Vercel's 10s limit
            new Promise(resolve => setTimeout(resolve, 8000)),
          ])
        }
      } catch { /* email is non-critical */ }
    }

    return NextResponse.json({ ok: true, scheduledAt: when.toISOString(), location: trimmedLocation || null })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/** Google Calendar wants UTC as YYYYMMDDTHHMMSSZ. Meetings are assumed to run an hour. */
function googleCalendarUrl({ title, start, details, location }: {
  title: string; start: Date; details: string; location: string
}) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  })
  if (location) params.set('location', location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Email HTML cannot resolve CSS custom properties, so Calibr brand values are
 * written as literal hex here: teal #14b8a6 / deep #0f766e on charcoal #0f172a.
 */
function buildScheduleEmail({ recipientName, managerName, when, location, portalUrl }: {
  recipientName: string
  managerName: string
  when: Date
  location: string
  portalUrl: string
}) {
  const dateLine = when.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const calendarUrl = googleCalendarUrl({
    title: 'Performance Review Meeting',
    start: when,
    details: `Your performance review meeting with ${managerName}.`,
    location,
  })

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 32px;">
      <div style="font-size:28px;margin-bottom:16px;">🗓️</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your performance review meeting is scheduled</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">
        Hi ${recipientName}, ${managerName} has scheduled your performance review meeting.
      </p>
      <div style="background:#f0fdfa;border:1px solid #14b8a6;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
        <div style="font-size:15px;font-weight:700;color:#0f766e;">${dateLine}</div>
        ${location ? `<div style="margin-top:6px;font-size:13px;color:#64748b;">${location}</div>` : ''}
      </div>
      <a href="${calendarUrl}" style="display:inline-block;padding:12px 28px;background:#0f766e;color:#ffffff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
        Add to Google Calendar
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
        You can review your self-assessment any time in <a href="${portalUrl}" style="color:#0f766e;">your portal</a>.
        You will be asked to sign the review after the meeting has taken place.
      </p>
    </div>
  </div>
</body>
</html>`
}
