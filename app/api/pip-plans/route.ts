import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — list PIPs for current user (manager sees their PIPs, employee sees their own, admin sees all)
export async function GET(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role

  const url = new URL(req.url)
  const employeeId = url.searchParams.get('employee_id')

  let query = svc
    .from('pip_plans')
    .select(`
      *,
      manager:profiles!pip_plans_manager_id_fkey(id, name, email),
      employee:profiles!pip_plans_employee_id_fkey(id, name, email)
    `)
    .order('created_at', { ascending: false })

  if (role === 'manager' || role === 'middle_manager') {
    query = employeeId
      ? query.eq('manager_id', user.id).eq('employee_id', employeeId)
      : query.eq('manager_id', user.id)
  } else if (role === 'employee') {
    query = query.eq('employee_id', user.id)
  }
  // admin/dev_admin sees all

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — create a new PIP
export async function POST(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const body = await req.json()
  const { employee_id, title, reason, start_date, target_date, milestones } = body

  if (!employee_id || !title || !start_date || !target_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await svc.from('pip_plans').insert({
    manager_id: user.id,
    employee_id,
    title,
    reason: reason || null,
    start_date,
    target_date,
    milestones: milestones || [],
    status: 'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// PATCH — update PIP (milestones, check-in notes, status, employee acknowledgement)
export async function PATCH(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Missing PIP id' }, { status: 400 })

  // Handle employee acknowledgement
  if (updates.employee_acknowledged) {
    updates.employee_acknowledged_at = new Date().toISOString()
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await svc
    .from('pip_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
