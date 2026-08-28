import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cycleAnniversaryYear } from '@/lib/review-cycle'
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

  const now = new Date()

  // Use the same anniversary-year math as the scheduled cron so both paths agree
  // on which annual period is current.
  const startDate = (emp as { start_date?: string | null }).start_date
  const anniversaryYear = startDate
    ? cycleAnniversaryYear(startDate, now)
    : now.getFullYear()

  // One cycle per employee per anniversary year. Block if this year's cycle
  // already exists at all — including a completed one, so a finished year can't
  // be re-triggered, and including one the cron already created.
  const { data: existing } = await svc
    .from('employee_review_cycles')
    .select('id')
    .eq('employee_id', employee_id)
    .eq('anniversary_year', anniversaryYear)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: `Employee already has a ${anniversaryYear} review cycle` },
      { status: 409 }
    )
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

  if (error) {
    // 23505 = unique_violation — the cron created this year's cycle in the gap
    // between the check above and this insert.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: `Employee already has a ${anniversaryYear} review cycle` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ cycle })
}
