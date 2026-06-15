import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET — get peer feedback
//
// ?request_id=UUID
//   - If caller is the reviewer: returns their own submission
//   - If caller is requestor / manager of requestor / admin: returns all
//     feedback for that request (anonymised if is_anonymous)
//
// ?requestor_id=UUID  (manager/admin) — all feedback for an employee
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const requestId = req.nextUrl.searchParams.get('request_id')
  const requestorId = req.nextUrl.searchParams.get('requestor_id')

  // Get caller profile for role check
  const { data: callerProfile } = await svc
    .from('profiles')
    .select('role, manager_id')
    .eq('id', user.id)
    .single()

  const callerRole = (callerProfile as { role: string; manager_id: string | null } | null)?.role

  // ---- ?request_id=UUID ----
  if (requestId) {
    // Fetch the request
    const { data: request } = await svc
      .from('feedback_requests')
      .select('id, requestor_id, reviewer_id, is_anonymous, status, year')
      .eq('id', requestId)
      .single()

    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const r = request as {
      id: string
      requestor_id: string
      reviewer_id: string
      is_anonymous: boolean
      status: string
      year: number
    }

    // Reviewer — return only their own submission
    if (r.reviewer_id === user.id) {
      const { data: feedback } = await svc
        .from('peer_feedback')
        .select('*')
        .eq('request_id', requestId)
        .eq('reviewer_id', user.id)
        .maybeSingle()

      return NextResponse.json({ feedback: feedback ?? null })
    }

    // Determine if caller is requestor, manager of requestor, or admin
    const isRequestor = r.requestor_id === user.id
    const isAdmin = callerRole === 'admin'

    let isManager = false
    if (!isRequestor && !isAdmin) {
      const { data: requestorProfile } = await svc
        .from('profiles')
        .select('manager_id')
        .eq('id', r.requestor_id)
        .single()
      isManager = (requestorProfile as { manager_id: string | null } | null)?.manager_id === user.id
    }

    if (!isRequestor && !isManager && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: feedbackList } = await svc
      .from('peer_feedback')
      .select('id, request_id, reviewer_id, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments, created_at')
      .eq('request_id', requestId)

    // Anonymise if needed (requestor cannot see who gave anonymous feedback)
    const sanitised = (feedbackList ?? []).map(f => {
      if (r.is_anonymous && isRequestor) {
        const { reviewer_id: _rid, ...rest } = f as typeof f & { reviewer_id: string }
        return rest
      }
      return f
    })

    return NextResponse.json({ feedback: sanitised })
  }

  // ---- ?requestor_id=UUID (manager/admin view) ----
  if (requestorId) {
    const isAdmin = callerRole === 'admin'
    let isManager = false

    if (!isAdmin) {
      const { data: targetProfile } = await svc
        .from('profiles')
        .select('manager_id')
        .eq('id', requestorId)
        .single()
      isManager = (targetProfile as { manager_id: string | null } | null)?.manager_id === user.id
    }

    if (!isAdmin && !isManager && user.id !== requestorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all requests for this employee
    const { data: requests } = await svc
      .from('feedback_requests')
      .select('id, is_anonymous')
      .eq('requestor_id', requestorId)

    const requestIds = (requests ?? []).map((r: { id: string }) => r.id)
    const isAnonymousMap = Object.fromEntries(
      (requests ?? []).map((r: { id: string; is_anonymous: boolean }) => [r.id, r.is_anonymous])
    )

    if (requestIds.length === 0) return NextResponse.json({ feedback: [] })

    const { data: feedbackList } = await svc
      .from('peer_feedback')
      .select('id, request_id, reviewer_id, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments, created_at')
      .in('request_id', requestIds)

    const sanitised = (feedbackList ?? []).map(f => {
      const fb = f as typeof f & { request_id: string; reviewer_id: string }
      if (isAnonymousMap[fb.request_id] && user.id === requestorId) {
        const { reviewer_id: _rid, ...rest } = fb
        return rest
      }
      return fb
    })

    return NextResponse.json({ feedback: sanitised })
  }

  return NextResponse.json({ error: 'request_id or requestor_id is required' }, { status: 400 })
}

// ---------------------------------------------------------------------------
// POST — submit peer feedback (authenticated reviewer)
// Body: { request_id, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const body = await req.json() as {
    request_id: string
    q1_strengths: string
    q2_improvements: string
    q3_collab_rating: number
    q3_collab_text: string
    additional_comments?: string
  }

  const { request_id, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments } = body

  if (!request_id || !q1_strengths || !q2_improvements || q3_collab_rating == null || !q3_collab_text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify the request exists and this user is the reviewer
  const { data: request } = await svc
    .from('feedback_requests')
    .select('id, requestor_id, reviewer_id, is_anonymous, status')
    .eq('id', request_id)
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const r = request as {
    id: string
    requestor_id: string
    reviewer_id: string
    is_anonymous: boolean
    status: string
  }

  if (r.reviewer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (r.status !== 'pending') {
    return NextResponse.json({ error: 'Feedback has already been submitted for this request' }, { status: 409 })
  }

  // Check for existing submission
  const { data: existingFeedback } = await svc
    .from('peer_feedback')
    .select('id')
    .eq('request_id', request_id)
    .maybeSingle()

  if (existingFeedback) {
    return NextResponse.json({ error: 'Feedback already submitted for this request' }, { status: 409 })
  }

  // Insert feedback
  const { data: newFeedback, error: insertError } = await svc
    .from('peer_feedback')
    .insert({
      request_id,
      reviewer_id: user.id,
      q1_strengths,
      q2_improvements,
      q3_collab_rating,
      q3_collab_text,
      additional_comments: additional_comments ?? null,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Update request status
  await svc
    .from('feedback_requests')
    .update({ status: 'submitted' })
    .eq('id', request_id)

  // Get reviewer name for notification
  const { data: reviewerProfile } = await svc
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const reviewerName = (reviewerProfile as { name: string | null } | null)?.name

  // Notify the requestor
  const notifBody = r.is_anonymous
    ? 'Someone submitted your 360 feedback'
    : `${reviewerName || 'Someone'} submitted your 360 feedback`

  await svc.from('notifications').insert({
    user_id: r.requestor_id,
    type: 'feedback_received',
    title: 'New feedback received',
    body: notifBody,
    reference_id: request_id,
  })

  return NextResponse.json({ feedback: newFeedback }, { status: 201 })
}
