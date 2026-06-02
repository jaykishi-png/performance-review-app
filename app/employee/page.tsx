import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeePortal from './EmployeePortal'

export default async function EmployeePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, manager_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'pending') redirect('/pending')
  if (profile.role === 'admin') redirect('/admin')
  if (profile.role === 'manager') redirect('/performance-review')

  // Fetch manager info
  let manager = null
  if (profile.manager_id) {
    const { data } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', profile.manager_id)
      .single()
    manager = data
  }

  return <EmployeePortal profile={profile} manager={manager} />
}
