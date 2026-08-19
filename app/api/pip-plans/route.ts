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
    // A manager sees PIPs they own, plus any opened on them as an employee.
    query = employeeId
      ? query.eq('manager_id', user.id).eq('employee_id', employeeId)
      : query.or(`manager_id.eq.${user.id},employee_id.eq.${user.id}`)
  } else if (role === 'employee') {
    query = query.eq('employee_id', user.id)
  } else if (role !== 'admin') {
    // Default deny — dev_admin and pending have no business reading PIP content.
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Fields a manager (or admin) may change on an existing PIP. Anything not listed
// here — id, manager_id, employee_id, created_at, the acknowledgement columns —
// is not writable through this endpoint.
const MANAGER_EDITABLE = [
  'title', 'reason', 'start_date', 'target_date',
  'status', 'outcome', 'milestones', 'check_in_notes',
] as const

const VALID_STATUS = ['active', 'completed', 'escalated', 'withdrawn']

async function getRole(svc: ReturnType<typeof createServiceClient>, userId: string): Promise<string> {
  const { data } = await svc.from('profiles').select('role').eq('id', userId).single()
  return (data as { role: string } | null)?.role ?? 'pending'
}

// POST — create a new PIP. Managers create for their own reports; admins too.
export async function POST(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const role = await getRole(svc, user.id)
  if (role !== 'manager' && role !== 'middle_manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { employee_id, title, reason, start_date, target_date, milestones } = body

  if (!employee_id || !title || !start_date || !target_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (employee_id === user.id) {
    return NextResponse.json({ error: 'Cannot open a PIP on yourself' }, { status: 400 })
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

// PATCH — update a PIP. The owning manager and admins may edit the plan itself
// (title, reason, dates, milestones, status, outcome, check-in log). The employee
// the PIP is about may only acknowledge it.
export async function PATCH(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const body = await req.json()
  const { id, ...incoming } = body

  if (!id) return NextResponse.json({ error: 'Missing PIP id' }, { status: 400 })

  const { data: existing } = await svc
    .from('pip_plans')
    .select('id, manager_id, employee_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pip = existing as { id: string; manager_id: string; employee_id: string }
  const role = await getRole(svc, user.id)
  const isOwningManager = pip.manager_id === user.id
    && (role === 'manager' || role === 'middle_manager')
  const isSubject = pip.employee_id === user.id
  const isAdmin = role === 'admin'

  const updates: Record<string, unknown> = {}

  if (isOwningManager || isAdmin) {
    for (const key of MANAGER_EDITABLE) {
      if (key in incoming) updates[key] = incoming[key]
    }
    if (typeof updates.status === 'string' && !VALID_STATUS.includes(updates.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
  } else if (isSubject) {
    // The employee can acknowledge, and nothing else.
    if (incoming.employee_acknowledged !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    updates.employee_acknowledged = true
    updates.employee_acknowledged_at = new Date().toISOString()
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
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
