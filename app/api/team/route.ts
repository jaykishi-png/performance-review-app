import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Returns employees whose profiles.manager_id = authenticated user's id
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()

    // Fetch direct reports from profiles
    const { data: reports } = await serviceClient
      .from('profiles')
      .select('id, name, email, role, is_active, start_date, position')
      .eq('manager_id', user.id)
      .eq('is_active', true)
      .order('name', { ascending: true })

    const reportIds = (reports ?? []).map((r: { id: string }) => r.id)

    // Fetch their self-assessment statuses
    let selfAssessments: { employee_id: string; status: string; submitted_at: string | null }[] = []
    if (reportIds.length > 0) {
      const { data } = await serviceClient
        .from('self_reviews')
        .select('employee_id, status, submitted_at')
        .in('employee_id', reportIds)
      selfAssessments = data ?? []
    }

    return NextResponse.json({ reports: reports ?? [], selfAssessments })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
