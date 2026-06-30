import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Returns employees whose profiles.manager_id = authenticated user's id
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()

    // Fetch direct reports from profiles (potential_rating may not exist yet pre-migration)
    let { data: reports, error: reportsError } = await serviceClient
      .from('profiles')
      .select('id, name, email, role, is_active, start_date, position, division, pronouns, potential_rating')
      .eq('manager_id', user.id)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (reportsError) {
      const { data: fallback } = await serviceClient
        .from('profiles')
        .select('id, name, email, role, is_active, start_date, position, division, pronouns')
        .eq('manager_id', user.id)
        .eq('is_active', true)
        .order('name', { ascending: true })
      reports = (fallback ?? []).map(r => ({ ...r, potential_rating: null }))
    }

    const reportIds = (reports ?? []).map((r: { id: string }) => r.id)

    // Fetch their self-assessment statuses
    let selfAssessments: { employee_id: string; status: string; submitted_at: string | null }[] = []
    if (reportIds.length > 0) {
      const { data } = await serviceClient
        .from('self_reviews')
        .select('employee_id, status, submitted_at')
        .in('employee_id', reportIds)
      selfAssessments = data ?? []
    }

    // Fetch active review cycles for all direct reports
    type ActiveCycle = {
      employee_id: string; id: string; phase: string; anniversary_year: number
      sa_open_at: string; sa_close_at: string
      review_open_at: string; review_close_at: string
      meeting_open_at: string; meeting_close_at: string
    }
    let activeCycles: ActiveCycle[] = []
    if (reportIds.length > 0) {
      const { data } = await serviceClient
        .from('employee_review_cycles')
        .select('employee_id, id, phase, anniversary_year, sa_open_at, sa_close_at, review_open_at, review_close_at, meeting_open_at, meeting_close_at')
        .in('employee_id', reportIds)
        .not('phase', 'eq', 'complete')
      activeCycles = (data ?? []) as ActiveCycle[]
    }

    return NextResponse.json({ reports: reports ?? [], selfAssessments, activeCycles })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH — manager updates potential_rating for a direct report
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { employee_id: string; potential_rating: number | null }
    const { employee_id, potential_rating } = body
    if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

    const serviceClient = createServiceClient()

    // Verify employee is a direct report of this manager
    const { data: emp } = await serviceClient
      .from('profiles')
      .select('manager_id')
      .eq('id', employee_id)
      .single()

    const e = emp as { manager_id: string | null } | null
    const isManager = e?.manager_id === user.id

    // Allow admin/dev_admin too
    const { data: callerProfile } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
    const callerRole = (callerProfile as { role: string } | null)?.role
    const isAdmin = callerRole === 'admin' || callerRole === 'dev_admin'

    if (!isManager && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await serviceClient
      .from('profiles')
      .update({ potential_rating: potential_rating ?? null })
      .eq('id', employee_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
