import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRoleHomeRoute } from '@/lib/permissions'

export default async function Home() {
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
}
