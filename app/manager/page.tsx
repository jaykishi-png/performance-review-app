import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerDashboard from './ManagerDashboard'

export const dynamic = 'force-dynamic'

export default async function ManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const { data: profileData } = await serviceClient
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { id: string; name: string | null; email: string; role: string } | null
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/forbidden')

  // Fetch direct reports
  const { data: directReportsData } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, is_active, start_date')
    .eq('manager_id', user.id)
    .eq('is_active', true)

  const directReports = (directReportsData ?? []) as {
    id: string; name: string | null; email: string; role: string; is_active: boolean; start_date: string | null
  }[]

  // Fetch manager's reviews
  const { data: reviewsData } = await serviceClient
    .from('reviews')
    .select('id, employee_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, saved_at, updated_at, manager_signed_at, employee_signed_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const reviews = (reviewsData ?? []) as {
    id: string; employee_id: string | null; employee_name: string; employee_position: string
    step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null
    saved_at: string; updated_at: string; manager_signed_at: string | null; employee_signed_at: string | null
  }[]

  // Fetch team self-assessments
  const drIds = directReports.map(dr => dr.id)
  let selfAssessments: { employee_id: string; status: string; submitted_at: string | null }[] = []
  if (drIds.length > 0) {
    const { data: saData } = await serviceClient
      .from('self_reviews')
      .select('employee_id, status, submitted_at')
      .in('employee_id', drIds)
    selfAssessments = (saData ?? []) as { employee_id: string; status: string; submitted_at: string | null }[]
  }

  return (
    <ManagerDashboard
      currentUser={{ id: user.id, email: user.email!, name: profile.name, role: profile.role }}
      directReports={directReports}
      reviews={reviews}
      selfAssessments={selfAssessments}
    />
  )
}
