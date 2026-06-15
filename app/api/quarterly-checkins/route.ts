import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getAuthContext() {
  const userClient = await createClient()
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return { user: null, role: null }

  const serviceClient = await createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { user, role: profile?.role ?? null }
}

// GET ?employee_id=UUID&year=2026&quarter=1
// Admin only: ?all=true&year=2026 to get all check-ins for a year
export async function GET(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const employee_id = searchParams.get('employee_id')
  const year = searchParams.get('year')
  const quarter = searchParams.get('quarter')
  const all = searchParams.get('all') === 'true'

  const isPrivileged = role === 'admin' || role === 'dev_admin'

  const serviceClient = await createServiceClient()

  // Admin: fetch all check-ins for a year
  if (all) {
    if (!isPrivileged) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!year) {
      return NextResponse.json({ error: 'year is required when using all=true' }, { status: 400 })
    }

    const { data, error } = await serviceClient
      .from('quarterly_checkins')
      .select('*')
      .eq('year', parseInt(year, 10))
      .order('quarter', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  }

  if (!employee_id) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }

  let query = serviceClient
    .from('quarterly_checkins')
    .select('*')
    .eq('employee_id', employee_id)

  if (year) query = query.eq('year', parseInt(year, 10))
  if (quarter) query = query.eq('quarter', parseInt(quarter, 10))

  query = query.order('year', { ascending: false }).order('quarter', { ascending: false })

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST — upsert check-in
export async function POST(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    employee_id?: string
    manager_id?: string
    year?: number
    quarter?: number
    type?: 'manager' | 'employee'
    pulse_rating?: number
    goal_progress?: unknown[]
    written_update?: string
    status?: 'draft' | 'submitted'
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { employee_id, manager_id, year, quarter, type, pulse_rating, goal_progress, written_update, status } = body

  if (!employee_id || !year || !quarter || !type) {
    return NextResponse.json({ error: 'employee_id, year, quarter, and type are required' }, { status: 400 })
  }

  if (type !== 'manager' && type !== 'employee') {
    return NextResponse.json({ error: 'type must be "manager" or "employee"' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const now = new Date().toISOString()

  // Build upsert payload based on type
  const basePayload: Record<string, unknown> = {
    employee_id,
    year,
    quarter,
  }

  if (manager_id) basePayload.manager_id = manager_id

  if (type === 'manager') {
    if (pulse_rating !== undefined) basePayload.manager_pulse_rating = pulse_rating
    if (goal_progress !== undefined) basePayload.manager_goal_progress = goal_progress
    if (written_update !== undefined) basePayload.manager_written_update = written_update
    if (status === 'submitted') basePayload.manager_submitted_at = now
  } else {
    if (pulse_rating !== undefined) basePayload.employee_pulse_rating = pulse_rating
    if (goal_progress !== undefined) basePayload.employee_goal_progress = goal_progress
    if (written_update !== undefined) basePayload.employee_written_update = written_update
    if (status === 'submitted') basePayload.employee_submitted_at = now
  }

  const { data, error } = await serviceClient
    .from('quarterly_checkins')
    .upsert(basePayload, { onConflict: 'employee_id,year,quarter' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 200 })
}
