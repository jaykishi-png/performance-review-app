import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/performance-review')
  }

  try {
    const { createClient, createServiceClient } = await import('@/lib/supabase/server')
    const { getRoleHomeRoute } = await import('@/lib/permissions')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile as { role: string } | null)?.role ?? 'pending'

    // Set role cookie for optimistic middleware route-family checks
    const cookieStore = await cookies()
    cookieStore.set('user_role', role, { httpOnly: false, sameSite: 'lax', path: '/' })

    redirect(getRoleHomeRoute(role as Parameters<typeof getRoleHomeRoute>[0]))
  } catch {
    redirect('/login')
  }
}
