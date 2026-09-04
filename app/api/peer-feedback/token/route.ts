import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Public route — token IS the authentication. No user auth required.
// createServiceClient() is used for all operations.

// ---------------------------------------------------------------------------
// GET ?token=UUID — get feedback request details for the public form
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

  const svc = createServiceClient()

  // Deliberately not a PostgREST embed. Reading the requestor through
  // `profiles!feedback_requests_requestor_id_fkey` fails whenever that
  // constraint is absent, and this is a public link: a lookup failure here
  // renders as "Link Not Found" to the reviewer, which is indistinguishable
  // from a genuinely bad token. Fetch the name separately so a valid link
  // always opens.
  const { data: request, error: requestError } = await svc
    .from('feedback_requests')
    .select('id, year, message, is_anonymous, status, requestor_id')
    .eq('token', token)
    .maybeSingle()

  // Surface a real failure as a 500. Collapsing it into 404 tells the reviewer
  // their link expired when nothing is wrong with it.
  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 })
  }
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const r = request as {
    id: string
    year: number
    message: string | null
    is_anonymous: boolean
    status: string
    requestor_id: string
  }

  const { data: requestorProfile } = await svc
    .from('profiles')
    .select('name, email')
    .eq('id', r.requestor_id)
    .maybeSingle()
  const requestor = requestorProfile as { name: string | null; email: string } | null

  // If already submitted, tell the client so the page can show the right state
  if (r.status === 'submitted') {
    return NextResponse.json({ status: 'submitted' })
  }

  return NextResponse.json({
    requestor_name: requestor?.name ?? requestor?.email ?? null,
    year: r.year,
    message: r.message,
    is_anonymous: r.is_anonymous,
    status: r.status,
  })
}

// ---------------------------------------------------------------------------
// POST — submit feedback via token (no auth)
// Body: { token, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const svc = createServiceClient()

  const body = await req.json() as {
    token: string
    q1_strengths: string
    q2_improvements: string
    q3_collab_rating: number
    q3_collab_text: string
    additional_comments?: string
  }

  const { token, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments } = body

  if (!token || !q1_strengths || !q2_improvements || q3_collab_rating == null || !q3_collab_text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Find request by token
  const { data: request } = await svc
    .from('feedback_requests')
    .select('id, requestor_id, reviewer_id, is_anonymous, status')
    .eq('token', token)
    .maybeSingle()

  if (!request) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const r = request as {
    id: string
    requestor_id: string
    reviewer_id: string
    is_anonymous: boolean
    status: string
  }

  if (r.status !== 'pending') {
    return NextResponse.json({ error: 'Feedback has already been submitted' }, { status: 409 })
  }

  // Insert feedback
  const { error: insertError } = await svc
    .from('peer_feedback')
    .insert({
      request_id: r.id,
      reviewer_id: r.reviewer_id,
      q1_strengths,
      q2_improvements,
      q3_collab_rating,
      q3_collab_text,
      additional_comments: additional_comments ?? null,
    })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Update request status
  await svc
    .from('feedback_requests')
    .update({ status: 'submitted' })
    .eq('id', r.id)

  // Get reviewer name for notification (only if not anonymous)
  let notifBody = 'Someone submitted your 360 feedback'
  if (!r.is_anonymous) {
    const { data: reviewerProfile } = await svc
      .from('profiles')
      .select('name')
      .eq('id', r.reviewer_id)
      .single()
    const reviewerName = (reviewerProfile as { name: string | null } | null)?.name
    if (reviewerName) {
      notifBody = `${reviewerName} submitted your 360 feedback`
    }
  }

  // Notify requestor
  await svc.from('notifications').insert({
    user_id: r.requestor_id,
    type: 'feedback_received',
    title: 'New feedback received',
    body: notifBody,
    reference_id: r.id,
  })

  return NextResponse.json({ ok: true })
}
