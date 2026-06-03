import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRoleHomeRoute } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/performance-review')
  }

  const supabase = await createClient()

  // Verify session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Read role using the authenticated client — profiles_read_own RLS policy allows this
  // Avoids service client cookie timing issues after OAuth redirect
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    // Fallback: try service client
    try {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const serviceClient = await createServiceClient()
      const { data: svcProfile } = await serviceClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const role = ((svcProfile as { role: string } | null)?.role ?? 'pending') as Role
      redirect(getRoleHomeRoute(role))
    } catch {
      redirect('/pending')
    }
  }

  const role = ((profile as { role: string } | null)?.role ?? 'pending') as Role
  redirect(getRoleHomeRoute(role))
}
