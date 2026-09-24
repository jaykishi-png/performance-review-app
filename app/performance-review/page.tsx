import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRoleHomeRoute, type Role } from '@/lib/permissions'
import { PerformanceReviewForm } from '@/components/performance-review/PerformanceReviewForm'

export const dynamic = 'force-dynamic'

/**
 * The role is resolved here rather than in the client.
 *
 * It used to be fetched once in the component's mount effect, so a role change
 * — an invite being applied, an admin editing a user — never reached a tab that
 * was already open: the sidebar kept rendering for the role the page happened to
 * load with. Server-rendering it means every navigation re-reads the role, and
 * it also gives this route the role gate it previously lacked.
 */
export default async function PerformanceReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Read with the authenticated client first — profiles_read_own covers it and
  // avoids service-client cookie timing right after the OAuth redirect.
  let profile: { role: string; name: string | null } | null = null
  const { data } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()
  profile = data as { role: string; name: string | null } | null

  if (!profile) {
    const { data: svc } = await createServiceClient()
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .single()
    profile = svc as { role: string; name: string | null } | null
  }

  const role = (profile?.role ?? 'pending') as Role
  // This portal is for managers. Everyone else goes to their own home.
  if (role !== 'manager' && role !== 'middle_manager') {
    redirect(getRoleHomeRoute(role))
  }

  return (
    <PerformanceReviewForm
      initialRole={role}
      initialName={profile?.name ?? ''}
      initialEmail={user.email ?? ''}
      initialUserId={user.id}
    />
  )
}
