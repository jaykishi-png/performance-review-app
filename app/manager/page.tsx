import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerDashboard from './ManagerDashboard'

export default async function ManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = await createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role, name, email')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  if (role !== 'manager') redirect('/forbidden')

  const { data: directReports } = await serviceClient
    .from('profiles')
    .select('id, name, email, role, is_active, start_date')
    .eq('manager_id', user.id)
    .eq('is_active', true)

  const { data: reviews } = await serviceClient
    .from('reviews')
    .select('id, employee_name, employee_position, step, max_step, saved_at, updated_at, drive_url, drive_doc_id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const directReportIds = (directReports ?? []).map((r: { id: string }) => r.id)
  let selfAssessments: { employee_id: string; status: string; submitted_at: string | null }[] = []
  if (directReportIds.length > 0) {
    const { data } = await serviceClient
      .from('self_reviews')
      .select('employee_id, status, submitted_at')
      .in('employee_id', directReportIds)
    selfAssessments = data ?? []
  }

  return (
    <ManagerDashboard
      currentUser={{ id: user.id, email: user.email!, name: (profile as { name: string | null } | null)?.name ?? null, role: 'manager' }}
      directReports={(directReports ?? []) as { id: string; name: string | null; email: string; role: string; is_active: boolean; start_date: string | null }[]}
      reviews={(reviews ?? []) as { id: string; employee_name: string; employee_position: string; step: number; max_step: number; saved_at: string; updated_at: string; drive_url: string | null; drive_doc_id: string | null }[]}
      selfAssessments={selfAssessments}
    />
  )
}
