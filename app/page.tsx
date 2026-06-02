import { redirect } from 'next/navigation'

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/performance-review')
  }

  try {
    const { createClient, createServiceClient } = await import('@/lib/supabase/server')
    const { getRoleHomeRoute } = await import('@/lib/permissions')

    // Verify identity with the user's session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Use service client to read profile — bypasses RLS reliably
    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'pending'
    redirect(getRoleHomeRoute(role))
  } catch {
    redirect('/performance-review')
  }
}
