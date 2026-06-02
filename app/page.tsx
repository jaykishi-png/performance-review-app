import { redirect } from 'next/navigation'

export default async function Home() {
  // If Supabase isn't configured yet, fall back to the original app
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/performance-review')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const { getRoleHomeRoute } = await import('@/lib/permissions')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
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
