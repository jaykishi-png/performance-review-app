import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

export const dynamic = 'force-dynamic'

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
    .select('id, employee_id, manager_id, status, submitted_at, created_at, updated_at')

  // Fetch all reviews — redact comparison_report for dev_admin
  const { data: reviewsRaw } = await serviceClient
    .from('reviews')
    .select('id, user_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, admin_approved_at, employee_id')
    .order('updated_at', { ascending: false })

  const reviews = (reviewsRaw ?? []).map(r => ({
    ...r,
    comparison_report: role === 'dev_admin' ? null : r.comparison_report,
  }))

  // A `reviews` row is only ever created by a manager (POST /api/reviews forbids
  // employees), so an employee who has started a self-assessment is invisible in
  // the admin Reviews list until their manager acts. Synthesise a placeholder row
  // for each such employee so the list tracks every in-flight review from the
  // employee's first action onward. These are read-only view rows, not real
  // `reviews` records — nothing is written to the database.
  type SelfAssessmentRow = {
    id: string; employee_id: string; manager_id: string | null
    status: string; submitted_at: string | null; created_at: string; updated_at: string
  }
  const usersById = new Map(
    ((users ?? []) as { id: string; name: string | null; email: string; position: string | null; manager_id: string | null }[])
      .map(u => [u.id, u]),
  )
  const employeesWithReview = new Set(
    reviews.map(r => r.employee_id).filter(Boolean) as string[],
  )

  const seenEmployee = new Set<string>()
  const selfAssessmentRows = ((selfAssessments ?? []) as SelfAssessmentRow[])
    .slice()
    // Most recent first, so an employee with more than one self-assessment
    // contributes only their latest.
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .filter(sa => {
      if (!sa.employee_id || employeesWithReview.has(sa.employee_id)) return false
      if (seenEmployee.has(sa.employee_id)) return false
      seenEmployee.add(sa.employee_id)
      return true
    })
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
      }
    })

  const allReviews = [
    ...reviews.map(r => ({ ...r, source: 'review' as const, sa_status: null, sa_submitted_at: null })),
    ...selfAssessmentRows,
  ].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

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

  return (
    <AdminDashboard
      currentUser={{ id: user.id, email: user.email!, role: role as 'admin' | 'dev_admin' }}
      users={(users ?? []) as {
        id: string; name: string | null; email: string; role: string;
        is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string; position: string | null; division: string | null; pronouns: string | null
      }[]}
      invites={invites ?? []}
      selfAssessments={(selfAssessments ?? []) as { employee_id: string; status: string; submitted_at: string | null }[]}
      reviews={allReviews as {
        id: string; user_id: string; employee_name: string; employee_position: string;
        step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null;
        comparison_report: string | null; saved_at: string; updated_at: string;
        manager_signed_at: string | null; employee_signed_at: string | null;
        manager_signature: string | null; employee_signature: string | null;
        admin_approved_at: string | null; employee_id?: string | null;
        source?: 'review' | 'self_assessment'; sa_status?: string | null; sa_submitted_at?: string | null;
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
