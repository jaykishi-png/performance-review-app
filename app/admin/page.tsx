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

  const { data: users } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, is_active, manager_id, start_date, created_at, position')
    .order('created_at', { ascending: false })

  const { data: invites } = await serviceClient
    .from('invites')
    .select('id, email, role, created_at, expires_at, accepted_at')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const { data: selfAssessments } = await serviceClient
    .from('self_reviews')
    .select('employee_id, status, submitted_at')

  // Fetch all reviews — redact comparison_report for dev_admin
  const { data: reviewsRaw } = await serviceClient
    .from('reviews')
    .select('id, user_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature')
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

  return (
    <AdminDashboard
      currentUser={{ id: user.id, email: user.email!, role: role as 'admin' | 'dev_admin' }}
      users={(users ?? []) as {
        id: string; name: string | null; email: string; role: string;
        is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string; position: string | null
      }[]}
      invites={invites ?? []}
      selfAssessments={(selfAssessments ?? []) as { employee_id: string; status: string; submitted_at: string | null }[]}
      reviews={reviews as {
        id: string; user_id: string; employee_name: string; employee_position: string;
        step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null;
        comparison_report: string | null; saved_at: string; updated_at: string;
        manager_signed_at: string | null; employee_signed_at: string | null;
        manager_signature: string | null; employee_signature: string | null;
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
