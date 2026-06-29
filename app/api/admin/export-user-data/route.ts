import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
    const { data: actorProfile } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
    const actorRole = (actorProfile as { role: string } | null)?.role
    if (actorRole !== 'admin' && actorRole !== 'dev_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetId = req.nextUrl.searchParams.get('userId')
    if (!targetId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const [
      profileRes,
      reviewsAsManagerRes,
      reviewsAsEmployeeRes,
      selfReviewRes,
      goalsRes,
      notesRes,
      pipsAsManagerRes,
      pipsAsEmployeeRes,
      checkinsRes,
      peerFeedbackRes,
      auditRes,
    ] = await Promise.all([
      serviceClient.from('profiles').select('*').eq('id', targetId).single(),
      serviceClient.from('reviews').select('*').eq('user_id', targetId),
      serviceClient.from('reviews').select('*').eq('employee_id', targetId),
      serviceClient.from('self_reviews').select('*').eq('employee_id', targetId),
      serviceClient.from('employee_goals').select('*').eq('employee_id', targetId),
      serviceClient.from('one_on_one_notes').select('*').or(`manager_id.eq.${targetId},employee_id.eq.${targetId}`),
      serviceClient.from('pip_plans').select('*').eq('manager_id', targetId),
      serviceClient.from('pip_plans').select('*').eq('employee_id', targetId),
      serviceClient.from('quarterly_checkins').select('*').eq('employee_id', targetId),
      serviceClient.from('feedback_requests').select('*').or(`requestor_id.eq.${targetId},reviewer_id.eq.${targetId}`),
      serviceClient.from('audit_logs').select('*').or(`actor_user_id.eq.${targetId},target_id.eq.${targetId}`).order('created_at', { ascending: false }),
    ])

    const exportPackage = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
      userId: targetId,
      profile: profileRes.data ?? null,
      reviews: {
        asManager: reviewsAsManagerRes.data ?? [],
        asEmployee: reviewsAsEmployeeRes.data ?? [],
      },
      selfReviews: selfReviewRes.data ?? [],
      goals: goalsRes.data ?? [],
      oneOnOneNotes: notesRes.data ?? [],
      pipPlans: {
        asManager: pipsAsManagerRes.data ?? [],
        asEmployee: pipsAsEmployeeRes.data ?? [],
      },
      quarterlyCheckins: checkinsRes.data ?? [],
      peerFeedbackRequests: peerFeedbackRes.data ?? [],
      auditLogs: auditRes.data ?? [],
    }

    return NextResponse.json(exportPackage)
  } catch (err) {
    console.error('[export-user-data]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
