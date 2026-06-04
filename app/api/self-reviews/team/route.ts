import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()

    // Get direct reports for this manager
    const { data: directReports } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('manager_id', user.id)
      .eq('is_active', true)

    const ids = (directReports ?? []).map((r: { id: string }) => r.id)
    if (ids.length === 0) return NextResponse.json({ selfAssessments: [] })

    const { data: selfAssessments } = await serviceClient
      .from('self_reviews')
      .select('employee_id, status, submitted_at')
      .in('employee_id', ids)

    return NextResponse.json({ selfAssessments: selfAssessments ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
