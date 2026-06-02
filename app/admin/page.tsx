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

  if ((profile as { role: string } | null)?.role !== 'admin') redirect('/performance-review')

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

  return (
    <AdminDashboard
      currentUser={{ id: user.id, email: user.email!, role: 'admin' }}
      users={(users ?? []) as {
        id: string; name: string | null; email: string; role: string;
        is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string
      }[]}
      invites={invites ?? []}
      selfAssessments={(selfAssessments ?? []) as { employee_id: string; status: string; submitted_at: string | null }[]}
    />
  )
}
