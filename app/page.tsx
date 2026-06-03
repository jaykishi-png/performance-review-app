import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRoleHomeRoute } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/performance-review')
  }

  // Verify session — redirect() must be outside try/catch in Next.js
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Look up role with service client (bypasses RLS)
  let role: Role = 'pending'
  try {
    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = ((profile as { role: string } | null)?.role ?? 'pending') as Role
  } catch {
    // If profile lookup fails, fall through to /pending
  }

  redirect(getRoleHomeRoute(role))
}
