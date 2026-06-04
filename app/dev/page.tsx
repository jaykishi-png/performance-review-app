import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevDashboard from './DevDashboard'

export default async function DevPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role, name, email')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  if (role !== 'dev_admin') redirect('/forbidden')

  const { count: reviewCount } = await serviceClient
    .from('reviews')
    .select('id', { count: 'exact', head: true })

  const { count: selfReviewCount } = await serviceClient
    .from('self_reviews')
    .select('id', { count: 'exact', head: true })

  const { count: userCount } = await serviceClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  const { data: recentAuditLogs } = await serviceClient
    .from('audit_logs')
    .select('id, action, actor_user_id, target_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

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

  return (
    <DevDashboard
      currentUser={{ id: user.id, email: user.email!, role: 'dev_admin' }}
      stats={{
        reviewCount: reviewCount ?? 0,
        selfReviewCount: selfReviewCount ?? 0,
        userCount: userCount ?? 0,
      }}
      recentAuditLogs={(recentAuditLogs ?? []) as {
        id: string; action: string; actor_user_id: string; target_type: string; created_at: string
      }[]}
      users={(users ?? []) as {
        id: string; name: string | null; email: string; role: string;
        is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string
      }[]}
      invites={invites ?? []}
    />
  )
}
