import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = await createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  if (role !== 'admin' && role !== 'dev_admin') redirect('/forbidden')

  const { data: users } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, is_active, manager_id, start_date, created_at')
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
    .select('id, user_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, comparison_report, saved_at, updated_at')
    .order('updated_at', { ascending: false })

  const reviews = (reviewsRaw ?? []).map(r => ({
    ...r,
    comparison_report: role === 'dev_admin' ? null : r.comparison_report,
  }))

  return (
    <AdminDashboard
      currentUser={{ id: user.id, email: user.email!, role: role as 'admin' | 'dev_admin' }}
      users={(users ?? []) as {
        id: string; name: string | null; email: string; role: string;
        is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string
      }[]}
      invites={invites ?? []}
      selfAssessments={(selfAssessments ?? []) as { employee_id: string; status: string; submitted_at: string | null }[]}
      reviews={reviews as {
        id: string; user_id: string; employee_name: string; employee_position: string;
        step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null;
        comparison_report: string | null; saved_at: string; updated_at: string;
      }[]}
    />
  )
}
