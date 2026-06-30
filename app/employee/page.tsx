import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeePortal from './EmployeePortal'

export const dynamic = 'force-dynamic'

export default async function EmployeePage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const params = await (searchParams ?? Promise.resolve({}))
  const initialPage = params['page'] ?? undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, manager_id, position')
    .eq('id', user.id)
    .single()

  if (profileError) console.error('[employee/page] profile fetch error:', profileError)
  if (!profile) redirect('/login')
  const p = profile as { id: string; name: string | null; email: string; role: string; manager_id: string | null; position: string | null }

  if (p.role === 'pending') redirect('/pending')
  if (p.role === 'admin') redirect('/admin')
  if (p.role === 'manager') redirect('/performance-review')
  if (p.role === 'dev_admin') redirect('/admin')

  // Fetch manager info via separate query (no FK constraint for join)
  let manager: { name: string | null; email: string } | null = null
  if (p.manager_id) {
    const { data: managerData, error: managerError } = await serviceClient
      .from('profiles')
      .select('name, email')
      .eq('id', p.manager_id)
      .single()
    if (managerError) console.error('[employee/page] manager fetch error — check SUPABASE_SERVICE_ROLE_KEY in Vercel env vars:', managerError)
    manager = managerData as { name: string | null; email: string } | null
  }

  // Fetch active review cycle (graceful fallback if table doesn't exist yet)
  let activeCycle: {
    id: string; phase: string; sa_open_at: string; sa_close_at: string
    review_open_at: string; review_close_at: string; meeting_open_at: string; meeting_close_at: string
    trigger_date: string; anniversary_year: number
  } | null = null
  let unreadCount = 0
  try {
    const { data: activeCycleRow } = await serviceClient
      .from('employee_review_cycles')
      .select('id, phase, sa_open_at, sa_close_at, review_open_at, review_close_at, meeting_open_at, meeting_close_at, trigger_date, anniversary_year')
      .eq('employee_id', user.id)
      .not('phase', 'eq', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    activeCycle = activeCycleRow as typeof activeCycle

    const { count } = await serviceClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)
    unreadCount = count ?? 0
  } catch { /* tables not yet created */ }

  // Fetch existing self-review
  const { data: srRow } = await serviceClient
    .from('self_reviews')
    .select('id, competencies, goals_objectives, next_year_goals, overall_rating, status, submitted_at, drive_url, drive_doc_id, strengths, growth_areas, overall_comments')
    .eq('employee_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const r = srRow as Record<string, unknown> | null
  const selfReview = r ? {
    id: r.id as string,
    // New template fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competencies: (r.competencies ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    goals_objectives: (r.goals_objectives ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next_year_goals: (r.next_year_goals ?? []) as any[],
    overall_rating: r.overall_rating as number | null,
    status: r.status as 'draft' | 'submitted',
    submitted_at: r.submitted_at as string | null,
    // Legacy
    strengths: r.strengths as string ?? '',
    growth_areas: r.growth_areas as string ?? '',
    overall_comments: r.overall_comments as string ?? '',
  } : null

  return (
    <EmployeePortal
      profile={p}
      position={p.position}
      manager={manager}
      initialSelfReview={selfReview}
      selfReviewId={r?.id as string ?? null}
      initialDriveUrl={r?.drive_url as string ?? null}
      activeCycle={activeCycle}
      unreadCount={unreadCount ?? 0}
      initialPage={initialPage}
    />
  )
}
