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

  const r = srRow as Record<string, unknown> | null
  const selfReview = r ? {
    id: r.id as string,
    // New template fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competencies: (r.competencies ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    goals_objectives: (r.goals_objectives ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next_year_goals: (r.next_year_goals ?? []) as any[],
    overall_rating: r.overall_rating as number | null,
    status: r.status as 'draft' | 'submitted',
    submitted_at: r.submitted_at as string | null,
    // Legacy
    strengths: r.strengths as string ?? '',
    growth_areas: r.growth_areas as string ?? '',
    overall_comments: r.overall_comments as string ?? '',
  } : null

  return <EmployeePortal profile={p} manager={manager} initialSelfReview={selfReview} />
}
