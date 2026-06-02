import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/performance-review')

  // Fetch all users
  const serviceClient = await createServiceClient()
  const { data: users } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, is_active, manager_id, created_at')
    .order('created_at', { ascending: false })

  // Fetch pending invites
  const { data: invites } = await serviceClient
    .from('invites')
    .select('id, email, role, created_at, expires_at, accepted_at')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return (
    <AdminDashboard
      currentUser={{ id: user.id, email: user.email!, role: 'admin' }}
      users={users ?? []}
      invites={invites ?? []}
    />
  )
}
