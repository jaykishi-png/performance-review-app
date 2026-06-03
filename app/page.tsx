import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRoleHomeRoute } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/performance-review')
  }

  let role: Role = 'pending'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    role = ((profile as { role: string } | null)?.role ?? 'pending') as Role
  } catch {
    redirect('/login')
  }

  // redirect() is outside try/catch so Next.js's internal redirect throw propagates correctly
  redirect(getRoleHomeRoute(role))
}
