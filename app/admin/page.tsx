import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

export const dynamic = 'force-dynamic'

// How much of a self-assessment has been filled in, as 0–1. The form's content
// lives inside the competencies / goals_objectives / next_year_goals arrays, so
// completion is the share of their leaf fields that are non-empty. A submitted
// self-assessment counts as complete regardless — submission is the milestone.
// Computed here rather than in the client so no self-assessment content is
// serialised into the page payload.
function selfAssessmentProgress(sa: {
  status: string
  competencies?: unknown; goals_objectives?: unknown
  next_year_goals?: unknown; overall_rating?: unknown
}): number {
  if (sa.status === 'submitted') return 1
  const isFilled = (v: unknown): boolean =>
    typeof v === 'string' ? v.trim().length > 0
      : typeof v === 'number' ? true
      : Array.isArray(v) ? v.length > 0
      : v !== null && typeof v === 'object' ? Object.keys(v as object).length > 0
      : false

  let total = 0
  let filled = 0
  for (const key of ['competencies', 'goals_objectives', 'next_year_goals'] as const) {
    const arr = sa[key]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        for (const v of Object.values(item as Record<string, unknown>)) {
          total++
          if (isFilled(v)) filled++
        }
      } else {
        total++
        if (isFilled(item)) filled++
      }
    }
  }
  total++
  if (isFilled(sa.overall_rating)) filled++

  return total === 0 ? 0 : filled / total
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  if (role !== 'admin' && role !== 'dev_admin') redirect('/forbidden')

  // potential_rating column added by migration — fall back gracefully if not yet run
  let { data: users, error: usersError } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, is_active, manager_id, start_date, created_at, position, division, pronouns, potential_rating')
    .order('created_at', { ascending: false })

  if (usersError) {
    const { data: usersFallback } = await serviceClient
      .from('profiles')
      .select('id, name, email, role, is_active, manager_id, start_date, created_at, position, division, pronouns')
      .order('created_at', { ascending: false })
    users = (usersFallback ?? []).map(u => ({ ...u, potential_rating: null }))
  }

  const { data: invites } = await serviceClient
    .from('invites')
    .select('id, email, role, created_at, expires_at, accepted_at, token')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const { data: selfAssessments } = await serviceClient
    .from('self_reviews')
    .select('id, employee_id, manager_id, status, submitted_at, created_at, updated_at, competencies, goals_objectives, next_year_goals, overall_rating')

  // Fetch all reviews — redact comparison_report for dev_admin
  const { data: reviewsRaw } = await serviceClient
    .from('reviews')
    .select('id, user_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, admin_approved_at, employee_id, meeting_confirmed_at')
    .order('updated_at', { ascending: false })

  const reviews = (reviewsRaw ?? []).map(r => ({
    ...r,
    comparison_report: role === 'dev_admin' ? null : r.comparison_report,
  }))

  const { data: cycles } = await serviceClient
    .from('review_cycles')
    .select('*')
    .order('created_at', { ascending: false })

  let employeeCycles: unknown[] = []
  try {
    const { data } = await serviceClient
      .from('employee_review_cycles')
      .select('*')
      .order('created_at', { ascending: false })
    employeeCycles = data ?? []
  } catch { /* table not yet created */ }
  // A `reviews` row is only ever created by a manager (POST /api/reviews forbids
  // employees), so an employee who has started a self-assessment is invisible in
  // the admin Reviews list until their manager acts. Synthesise a placeholder row
  // for each such employee so the list tracks every in-flight review from the
  // employee's first action onward. These are read-only view rows, not real
  // `reviews` records — nothing is written to the database.
  type SelfAssessmentRow = {
    id: string; employee_id: string; manager_id: string | null
    status: string; submitted_at: string | null; created_at: string; updated_at: string
    competencies?: unknown; goals_objectives?: unknown
    next_year_goals?: unknown; overall_rating?: unknown
  }
  const usersById = new Map(
    ((users ?? []) as { id: string; name: string | null; email: string; position: string | null; manager_id: string | null }[])
      .map(u => [u.id, u]),
  )
  const employeesWithReview = new Set(
    reviews.map(r => r.employee_id).filter(Boolean) as string[],
  )

  // Latest self-assessment per employee. Attached to every row, not just the
  // placeholders, so the progress bar can span the whole lifecycle — the
  // self-assessment stages included — for manager-authored reviews too.
  const saByEmployee = new Map<string, SelfAssessmentRow>()
  for (const sa of ((selfAssessments ?? []) as SelfAssessmentRow[])
    .slice()
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))) {
    if (sa.employee_id && !saByEmployee.has(sa.employee_id)) saByEmployee.set(sa.employee_id, sa)
  }

  const selfAssessmentRows = [...saByEmployee.values()]
    .filter(sa => !employeesWithReview.has(sa.employee_id))
    .map(sa => {
      const emp = usersById.get(sa.employee_id)
      return {
        id: `sa:${sa.id}`,
        user_id: sa.manager_id ?? emp?.manager_id ?? '',
        employee_name: emp?.name ?? emp?.email ?? 'Unknown',
        employee_position: emp?.position ?? '',
        step: 0,
        max_step: 0,
        // Deliberately null. A self-assessment can have its own Drive export, but
        // surfacing it here would make the row read as the *manager review* having
        // been exported, which is a different stage entirely.
        drive_url: null,
        drive_doc_id: null,
        comparison_report: null,
        saved_at: sa.updated_at,
        updated_at: sa.updated_at,
        manager_signed_at: null,
        employee_signed_at: null,
        manager_signature: null,
        employee_signature: null,
        admin_approved_at: null,
        employee_id: sa.employee_id,
        source: 'self_assessment' as const,
        sa_status: sa.status,
        sa_submitted_at: sa.submitted_at,
        sa_progress: selfAssessmentProgress(sa),
      }
    })

  const reviewRows = [
    ...reviews.map(r => {
      const sa = r.employee_id ? saByEmployee.get(r.employee_id) : undefined
      return {
        ...r,
        source: 'review' as const,
        sa_status: sa?.status ?? null,
        sa_submitted_at: sa?.submitted_at ?? null,
        sa_progress: sa ? selfAssessmentProgress(sa) : 0,
      }
    }),
  ]


  // Employees whose review period has opened but who have started nothing at all.
  // These are the true 0% of the process; without them that state is invisible,
  // since a row otherwise only exists once an employee or manager acts.
  type EmployeeCycleRow = {
    id: string; employee_id: string; phase: string
    sa_open_at: string | null; trigger_date: string | null
  }
  const nowIso = new Date().toISOString()
  const latestCycleByEmployee = new Map<string, EmployeeCycleRow>()
  for (const c of (employeeCycles as EmployeeCycleRow[])
    .slice()
    .sort((a, b) => (b.sa_open_at ?? b.trigger_date ?? '').localeCompare(a.sa_open_at ?? a.trigger_date ?? ''))) {
    if (c.employee_id && !latestCycleByEmployee.has(c.employee_id)) latestCycleByEmployee.set(c.employee_id, c)
  }

  const notStartedRows = [...latestCycleByEmployee.values()]
    .filter(c =>
      c.phase !== 'complete'
      && !!c.sa_open_at && c.sa_open_at <= nowIso
      && !employeesWithReview.has(c.employee_id)
      && !saByEmployee.has(c.employee_id))
    .map(c => {
      const emp = usersById.get(c.employee_id)
      return {
        id: `cycle:${c.id}`,
        user_id: emp?.manager_id ?? '',
        employee_name: emp?.name ?? emp?.email ?? 'Unknown',
        employee_position: emp?.position ?? '',
        step: 0,
        max_step: 0,
        drive_url: null,
        drive_doc_id: null,
        comparison_report: null,
        saved_at: c.sa_open_at ?? nowIso,
        updated_at: c.sa_open_at ?? nowIso,
        manager_signed_at: null,
        employee_signed_at: null,
        manager_signature: null,
        employee_signature: null,
        admin_approved_at: null,
        meeting_confirmed_at: null,
        employee_id: c.employee_id,
        source: 'cycle' as const,
        sa_status: null,
        sa_submitted_at: null,
        sa_progress: 0,
      }
    })

  const allReviews = [...reviewRows, ...selfAssessmentRows, ...notStartedRows]
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

  return (
    <AdminDashboard
      currentUser={{ id: user.id, email: user.email!, role: role as 'admin' | 'dev_admin' }}
      users={(users ?? []) as {
        id: string; name: string | null; email: string; role: string;
        is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string; position: string | null; division: string | null; pronouns: string | null
      }[]}
      invites={invites ?? []}
      selfAssessments={((selfAssessments ?? []) as SelfAssessmentRow[])
        .map(s => ({ employee_id: s.employee_id, status: s.status, submitted_at: s.submitted_at }))}
      reviews={allReviews as {
        id: string; user_id: string; employee_name: string; employee_position: string;
        step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null;
        comparison_report: string | null; saved_at: string; updated_at: string;
        manager_signed_at: string | null; employee_signed_at: string | null;
        manager_signature: string | null; employee_signature: string | null;
        admin_approved_at: string | null; employee_id?: string | null;
        source?: 'review' | 'self_assessment' | 'cycle'; sa_status?: string | null; sa_submitted_at?: string | null;
        sa_progress?: number;
        meeting_confirmed_at?: string | null;
      }[]}
      employeeCycles={(employeeCycles ?? []) as {
        id: string; employee_id: string; anniversary_year: number; phase: string
        trigger_date: string; sa_open_at: string; sa_close_at: string
        review_open_at: string; review_close_at: string; meeting_open_at: string; meeting_close_at: string
        sa_submitted_at: string | null; review_exported_at: string | null
        manager_signed_at: string | null; employee_signed_at: string | null
        admin_confirmed_at: string | null; confirmed_by: string | null
        created_at: string; updated_at: string
      }[]}
      cycles={(cycles ?? []) as {
        id: string; name: string; description: string | null; status: 'draft' | 'active' | 'closed';
        sa_open: string | null; sa_close: string | null; review_open: string | null; review_close: string | null;
        created_by: string | null; published_at: string | null; closed_at: string | null;
        created_at: string; updated_at: string;
      }[]}
    />
  )
}
