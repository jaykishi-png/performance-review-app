import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (role !== 'admin' && role !== 'dev_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employee_id, sa_days = 14 } = await req.json() as { employee_id: string; sa_days?: number }
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

  const { data: emp } = await svc
    .from('profiles')
    .select('id, name, email, start_date')
    .eq('id', employee_id)
    .single()
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Block if an active cycle already exists
  const { data: existing } = await svc
    .from('employee_review_cycles')
    .select('id, phase')
    .eq('employee_id', employee_id)
    .not('phase', 'eq', 'complete')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Employee already has an active review cycle' }, { status: 409 })

  const now = new Date()

  // Determine anniversary_year — use the year of the most recent or upcoming anniversary
  let anniversaryYear = now.getFullYear()
  if ((emp as { start_date?: string | null }).start_date) {
    const sd = new Date((emp as { start_date: string }).start_date + 'T00:00:00')
    const thisYearAnn = new Date(now.getFullYear(), sd.getMonth(), sd.getDate())
    // If anniversary already passed this year, we're in this cycle year
    anniversaryYear = thisYearAnn <= now ? now.getFullYear() : now.getFullYear() - 1
  }

  // Build windows anchored at now
  const saOpen = new Date(now)
  const saClose = new Date(saOpen); saClose.setDate(saClose.getDate() + sa_days)
  const revOpen = new Date(saClose)
  const revClose = new Date(revOpen); revClose.setDate(revClose.getDate() + 14)
  const meetOpen = new Date(revClose)
  const meetClose = new Date(meetOpen); meetClose.setDate(meetClose.getDate() + 7)

  const { data: cycle, error } = await svc
    .from('employee_review_cycles')
    .insert({
      employee_id,
      anniversary_year: anniversaryYear,
      phase: 'sa_open',
      trigger_date: now.toISOString().split('T')[0],
      sa_open_at: saOpen.toISOString(),
      sa_close_at: saClose.toISOString(),
      review_open_at: revOpen.toISOString(),
      review_close_at: revClose.toISOString(),
      meeting_open_at: meetOpen.toISOString(),
      meeting_close_at: meetClose.toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cycle })
}
