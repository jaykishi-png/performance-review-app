import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET — get peer feedback
//
// Peer feedback is manager-managed — the employee it is about cannot read it.
//
// ?request_id=UUID
//   - If caller is the reviewer: returns their own submission
//   - If caller is manager of requestor / admin: returns all feedback for that
//     request (historical anonymous reviewers stay hidden from the requestor)
//
// ?requestor_id=UUID  (manager/admin only) — all feedback for an employee
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

    // Determine if caller is manager of requestor, or admin. Peer feedback is
    // manager-managed: the employee it is about cannot read it.
    // /admin admits dev_admin too, so this must match or the admin portal's own
    // feedback view 403s for that role.
    const isAdmin = callerRole === 'admin' || callerRole === 'dev_admin'

    let isManager = false
    if (!isAdmin) {
      const { data: requestorProfile } = await svc
        .from('profiles')
        .select('manager_id')
        .eq('id', r.requestor_id)
        .single()
      isManager = (requestorProfile as { manager_id: string | null } | null)?.manager_id === user.id
    }

    if (!isManager && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: feedbackList } = await svc
      .from('peer_feedback')
      .select('id, request_id, reviewer_id, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments, submitted_at, created_at')
      .eq('request_id', requestId)

    // New requests are never anonymous, but historical ones may be — never
    // reveal those reviewers to the person the feedback is about.
    const sanitised = (feedbackList ?? []).map(f => {
      if (r.is_anonymous && r.requestor_id === user.id) {
        const { reviewer_id: _rid, ...rest } = f as typeof f & { reviewer_id: string }
        return rest
      }
      return f
    })

    return NextResponse.json({ feedback: sanitised })
  }

  // ---- ?requestor_id=UUID (manager/admin view) ----
  if (requestorId) {
    // /admin admits dev_admin too, so this must match or the admin portal's own
    // feedback view 403s for that role.
    const isAdmin = callerRole === 'admin' || callerRole === 'dev_admin'
    let isManager = false

    if (!isAdmin) {
      const { data: targetProfile } = await svc
        .from('profiles')
        .select('manager_id')
        .eq('id', requestorId)
        .single()
      isManager = (targetProfile as { manager_id: string | null } | null)?.manager_id === user.id
    }

    // Peer feedback is manager-managed: the employee it is about cannot read it.
    if (!isAdmin && !isManager) {
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
      .select('id, request_id, reviewer_id, q1_strengths, q2_improvements, q3_collab_rating, q3_collab_text, additional_comments, submitted_at, created_at')
      .in('request_id', requestIds)

    // Resolve reviewer names here rather than making the client do it — the
    // views render "who said this", and an id alone leaves them showing Unknown.
    const reviewerIds = [...new Set((feedbackList ?? []).map(f => (f as { reviewer_id: string }).reviewer_id))]
    const { data: reviewers } = reviewerIds.length
      ? await svc.from('profiles').select('id, name, email').in('id', reviewerIds)
      : { data: [] }
    const reviewerById = new Map(
      ((reviewers ?? []) as { id: string; name: string | null; email: string }[]).map(p => [p.id, p])
    )

    const sanitised = (feedbackList ?? []).map(f => {
      const fb = f as typeof f & { request_id: string; reviewer_id: string }
      const isAnonymous = !!isAnonymousMap[fb.request_id]

      // An anonymous reviewer is never revealed to the person the feedback is
      // about; managers and admins see the name.
      if (isAnonymous && user.id === requestorId) {
        const { reviewer_id: _rid, ...rest } = fb
        return { ...rest, is_anonymous: true, reviewer_name: null, reviewer_email: null }
      }

      const reviewer = reviewerById.get(fb.reviewer_id)
      return {
        ...fb,
        is_anonymous: isAnonymous,
        reviewer_name: reviewer?.name ?? null,
        reviewer_email: reviewer?.email ?? null,
      }
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

// ---------------------------------------------------------------------------
// DELETE ?request_id=UUID — remove a submission (admin)
//
// The request is reopened rather than left marked submitted: a request with no
// feedback behind it would otherwise be stranded, and the reviewer's original
// link would keep reporting that it was already answered.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: callerProfile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = (callerProfile as { role: string } | null)?.role
  if (role !== 'admin' && role !== 'dev_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requestId = req.nextUrl.searchParams.get('request_id')
  if (!requestId) return NextResponse.json({ error: 'request_id is required' }, { status: 400 })

  const { data: request } = await svc
    .from('feedback_requests')
    .select('id')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const { error: deleteError, count } = await svc
    .from('peer_feedback')
    .delete({ count: 'exact' })
    .eq('request_id', requestId)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const { error: statusError } = await svc
    .from('feedback_requests')
    .update({ status: 'pending' })
    .eq('id', requestId)
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
