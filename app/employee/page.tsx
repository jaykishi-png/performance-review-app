import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeePortal from './EmployeePortal'

export default async function EmployeePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = await createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, manager_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  const p = profile as { id: string; name: string | null; email: string; role: string; manager_id: string | null }

  if (p.role === 'pending') redirect('/pending')
  if (p.role === 'admin') redirect('/admin')
  if (p.role === 'manager') redirect('/performance-review')

  // Fetch manager info
  let manager = null
  if (p.manager_id) {
    const { data } = await serviceClient
      .from('profiles')
      .select('name, email')
      .eq('id', p.manager_id)
      .single()
    manager = data as { name: string | null; email: string } | null
  }

  // Fetch existing self-review
  const { data: srRow } = await serviceClient
    .from('self_reviews')
    .select('*')
    .eq('employee_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const selfReview = srRow ? {
    id: (srRow as Record<string, unknown>).id as string,
    strengths: (srRow as Record<string, unknown>).strengths as string ?? '',
    growth_areas: (srRow as Record<string, unknown>).growth_areas as string ?? '',
    goal_reflections: ((srRow as Record<string, unknown>).goal_reflections as { goal: string; reflection: string }[]) ?? [],
    overall_rating: (srRow as Record<string, unknown>).overall_rating as number | null,
    overall_comments: (srRow as Record<string, unknown>).overall_comments as string ?? '',
    status: (srRow as Record<string, unknown>).status as 'draft' | 'submitted',
    submitted_at: (srRow as Record<string, unknown>).submitted_at as string | null,
  } : null

  return <EmployeePortal profile={p} manager={manager} initialSelfReview={selfReview} />
}
