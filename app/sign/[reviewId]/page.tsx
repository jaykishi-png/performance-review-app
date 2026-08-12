import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewSignPage from './ReviewSignPage'

export const dynamic = 'force-dynamic'

export default async function SignPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/sign/${reviewId}`)

  const svc = createServiceClient()

  const { data: profile } = await svc.from('profiles').select('id, name, email, role').eq('id', user.id).single()
  const p = profile as { id: string; name: string | null; email: string; role: string } | null
  if (!p || p.role === 'pending') redirect(`/login?next=/sign/${reviewId}`)

  // Fetch review by ID — service client bypasses RLS, access check done below in code
  const { data: review } = await svc
    .from('reviews')
    .select('id, user_id, employee_id, employee_name, employee_position, form_data, comparison_report, manager_signed_at, manager_signature, employee_signed_at, employee_signature, drive_url, meeting_confirmed_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (!review) redirect('/')

  const rv = review as {
    id: string
    user_id: string
    employee_id: string | null
    employee_name: string | null
    employee_position: string | null
    form_data: Record<string, unknown> | null
    comparison_report: string | null
    manager_signed_at: string | null
    manager_signature: string | null
    employee_signed_at: string | null
    employee_signature: string | null
    drive_url: string | null
    meeting_confirmed_at: string | null
  }

  const isManager = rv.user_id === user.id
  const isEmployee = rv.employee_id === user.id
  const isAdmin = p.role === 'admin' || p.role === 'dev_admin'

  // An employee must not reach their own performance review before the manager
  // has confirmed the review meeting happened. Managers and admins are exempt —
  // the manager needs this page to sign before confirming.
  if (isEmployee && !isManager && !isAdmin && !rv.meeting_confirmed_at) {
    redirect('/employee?page=reviews')
  }
  // Allow any authenticated non-pending user who arrives with a valid UUID link —
  // the review ID is unguessable (128-bit UUID), so possession of the URL is sufficient.

  // Fetch SA data for the employee
  let saData: Record<string, unknown> | null = null
  if (rv.employee_id) {
    const { data: srRow } = await svc
      .from('self_reviews')
      .select('competencies, goals_objectives, next_year_goals, overall_rating, submitted_at, strengths, growth_areas')
      .eq('employee_id', rv.employee_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (srRow) saData = srRow as Record<string, unknown>
  }

  return (
    <ReviewSignPage
      review={rv}
      saData={saData}
      currentUserId={user.id}
      currentUserRole={p.role}
      currentUserName={p.name || p.email}
      isManager={isManager}
      isEmployee={isEmployee || isAdmin}
    />
  )
}
