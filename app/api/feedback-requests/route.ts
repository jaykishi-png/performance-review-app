import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'


export const dynamic = 'force-dynamic'

const APP_URL = getAppUrl()

// ---------------------------------------------------------------------------
// GET — list feedback requests for the current user
// ?role=requestor  → requests I created (I am the requestor)
// ?role=reviewer   → requests I was asked to complete (I am the reviewer)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const role = req.nextUrl.searchParams.get('role') ?? 'requestor'
  const all = req.nextUrl.searchParams.get('all') === 'true'
  const year = req.nextUrl.searchParams.get('year')

  // Admin-only: fetch all requests across the org
  if (all) {
    const { data: profile } = await svc
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const userRole = (profile as { role: string } | null)?.role
    if (userRole !== 'admin' && userRole !== 'dev_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    let adminQuery = svc
      .from('feedback_requests')
      .select(`
        id, year, message, is_anonymous, status, token, created_at,
        requestor:profiles!feedback_requests_requestor_id_fkey(id, name, email),
        reviewer:profiles!feedback_requests_reviewer_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })
    if (year) adminQuery = adminQuery.eq('year', parseInt(year))
    const { data: allData, error: allError } = await adminQuery
    if (allError) return NextResponse.json({ error: allError.message }, { status: 500 })

    // feedback_requests records when the request was *sent*; the date the
    // reviewer actually answered lives on peer_feedback. Attach it so the admin
    // list can show a submitted date rather than the request's creation date.
    const rows = (allData ?? []) as { id: string }[]
    const ids = rows.map(r => r.id)
    const { data: submissions } = ids.length
      ? await svc.from('peer_feedback').select('request_id, submitted_at, created_at').in('request_id', ids)
      : { data: [] }
    const submittedAt = new Map(
      ((submissions ?? []) as { request_id: string; submitted_at: string | null; created_at: string }[])
        .map(f => [f.request_id, f.submitted_at ?? f.created_at])
    )

    return NextResponse.json({
      requests: rows.map(r => ({ ...r, submitted_at: submittedAt.get(r.id) ?? null })),
    })
  }

  let query = svc
    .from('feedback_requests')
    .select(`
      id, year, message, is_anonymous, status, token, created_at,
      requestor:profiles!feedback_requests_requestor_id_fkey(id, name, email),
      reviewer:profiles!feedback_requests_reviewer_id_fkey(id, name, email)
    `)
    .order('created_at', { ascending: false })

  if (role === 'reviewer') {
    query = query.eq('reviewer_id', user.id)
  } else {
    query = query.eq('requestor_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [] })
}

// ---------------------------------------------------------------------------
// POST — create a feedback request
// Body: { reviewer_id, year, message?, is_anonymous?, requestor_id? }
// requestor_id may be set by managers/admins to create requests on behalf of a direct report
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const body = await req.json() as {
    reviewer_id: string
    year: number
    message?: string
    is_anonymous?: boolean
    requestor_id?: string
  }

  const { reviewer_id, year, message, is_anonymous } = body
  let requestorId = user.id

  // Allow managers/admins to specify a different requestor (on behalf of direct report)
  if (body.requestor_id && body.requestor_id !== user.id) {
    const { data: callerProfile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const callerRole = (callerProfile as { role: string } | null)?.role
    const isAdmin = callerRole === 'admin' || callerRole === 'dev_admin'

    // Managers can only override if the target is their direct report
    if (!isAdmin) {
      const { data: targetProfile } = await svc.from('profiles').select('manager_id').eq('id', body.requestor_id).single()
      const isDirectReport = (targetProfile as { manager_id: string | null } | null)?.manager_id === user.id
      if (!isDirectReport) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    requestorId = body.requestor_id
  }

  if (!reviewer_id || !year) {
    return NextResponse.json({ error: 'reviewer_id and year are required' }, { status: 400 })
  }

  // Cannot request feedback from the requestor themselves
  if (reviewer_id === requestorId) {
    return NextResponse.json({ error: 'Cannot request feedback from the same person being reviewed' }, { status: 400 })
  }

  // Check for duplicate
  const { data: existing } = await svc
    .from('feedback_requests')
    .select('id')
    .eq('requestor_id', requestorId)
    .eq('reviewer_id', reviewer_id)
    .eq('year', year)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A feedback request for this reviewer and year already exists' },
      { status: 409 }
    )
  }

  // Get requestor profile (for email notification)
  const { data: requestorProfile } = await svc
    .from('profiles')
    .select('name, email')
    .eq('id', requestorId)
    .single()

  // Get reviewer profile
  const { data: reviewerProfile } = await svc
    .from('profiles')
    .select('name, email')
    .eq('id', reviewer_id)
    .single()

  const token = crypto.randomUUID()

  const { data: newRequest, error: insertError } = await svc
    .from('feedback_requests')
    .insert({
      requestor_id: requestorId,
      reviewer_id,
      year,
      message: message ?? null,
      is_anonymous: is_anonymous ?? false,
      status: 'pending',
      token,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const requestorName = (requestorProfile as { name: string | null; email: string } | null)?.name ||
    (requestorProfile as { name: string | null; email: string } | null)?.email ||
    user.email || 'A colleague'

  const reviewerEmail = (reviewerProfile as { name: string | null; email: string } | null)?.email
  const reviewerName = (reviewerProfile as { name: string | null; email: string } | null)?.name ||
    reviewerEmail || 'Reviewer'

  // Send email to reviewer
  let emailSent = false
  if (reviewerEmail) {
    try {
      const { sendEmail } = await import('@/lib/email')
      const feedbackLink = `${APP_URL}/feedback/${token}`
      await sendEmail({
        to: reviewerEmail,
        subject: `${requestorName} has requested your feedback`,
        html: buildFeedbackRequestEmail({ requestorName, reviewerName, year, feedbackLink, message: message ?? null }),
      })
      emailSent = true
    } catch (err) {
      console.error('[feedback-requests] email send failed:', err)
    }
  }

  // Create in-app notification for reviewer
  await svc.from('notifications').insert({
    user_id: reviewer_id,
    type: 'feedback_request',
    title: 'Feedback requested',
    body: `${requestorName} has asked for your 360 feedback`,
    reference_id: newRequest.id,
  })

  return NextResponse.json({ request: newRequest, email_sent: emailSent, reviewer_email: reviewerEmail ?? null }, { status: 201 })
}

// ---------------------------------------------------------------------------
// DELETE — cancel a pending request
// ?id=UUID
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const svc = createServiceClient()

  // Verify ownership and status
  const { data: request } = await svc
    .from('feedback_requests')
    .select('id, requestor_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  if ((request as { requestor_id: string }).requestor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if ((request as { status: string }).status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 })
  }

  const { error: deleteError } = await svc
    .from('feedback_requests')
    .delete()
    .eq('id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------
function buildFeedbackRequestEmail({
  requestorName,
  reviewerName,
  year,
  feedbackLink,
  message,
}: {
  requestorName: string
  reviewerName: string
  year: number
  feedbackLink: string
  message: string | null
}) {
  const personalNote = message
    ? `<tr><td style="padding:0 40px 24px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="background:#0d0f1a;border:1px solid #2d3148;border-radius:10px;padding:16px 20px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:0.06em;">Message from ${requestorName}</p>
            <p style="margin:0;font-size:14px;color:#c4c9d4;line-height:1.6;">${message}</p>
          </td></tr>
        </table>
       </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f0f2fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d14;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#13151f;border:1px solid #1e2130;border-radius:16px;overflow:hidden;max-width:540px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2130;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;font-size:20px;">📋</td>
              <td style="padding-left:12px;font-size:18px;font-weight:700;color:#f0f2fa;">Performance Review</td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px 24px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f0f2fa;letter-spacing:-0.3px;">
            Feedback requested
          </h1>
          <p style="margin:0 0 8px;font-size:15px;color:#9ca3af;line-height:1.6;">
            Hi <strong style="color:#c4c9d4;">${reviewerName}</strong>,
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">
            <strong style="color:#c4c9d4;">${requestorName}</strong> has asked for your feedback as part of their <strong style="color:#c4c9d4;">${year}</strong> performance review.
            This takes about 5 minutes and your response can be kept anonymous.
          </p>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;">
              <a href="${feedbackLink}" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;text-align:center;">
                Give Feedback →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:11px;color:#374151;line-height:1.6;">
            If the button doesn&apos;t work, copy and paste this link:<br>
            <span style="color:#4f46e5;">${feedbackLink}</span>
          </p>
        </td></tr>

        ${personalNote}

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #1e2130;text-align:center;">
          <p style="margin:0;font-size:11px;color:#374151;">Performance Review · You received this because ${requestorName} listed you as a peer reviewer.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
