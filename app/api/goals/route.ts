import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — goals for logged-in employee, or ?employee_id=UUID for manager/admin
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()

    // Role check
    const { data: profile } = await serviceClient.from('profiles').select('role, manager_id').eq('id', user.id).single()
    const role = profile?.role ?? 'employee'

    const targetId = new URL(req.url).searchParams.get('employee_id')

    // Managers and admins can fetch any employee's goals
    if (targetId && targetId !== user.id) {
      if (role !== 'admin' && role !== 'dev_admin' && role !== 'manager') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data, error } = await serviceClient
        .from('employee_goals')
        .select('*')
        .eq('employee_id', targetId)
        .order('created_at', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ goals: data ?? [] })
    }

    const { data, error } = await serviceClient
      .from('employee_goals')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ goals: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create a new goal
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      title: string; description?: string; status?: string; target_date?: string; notes?: string
    }
    if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('employee_goals')
      .insert({
        employee_id: user.id,
        title: body.title.trim(),
        description: body.description ?? '',
        status: body.status ?? 'not_started',
        target_date: body.target_date ?? '',
        notes: body.notes ?? '',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ goal: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update a goal
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { id: string; [key: string]: unknown }
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('employee_goals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('employee_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove a goal
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('employee_goals')
      .delete()
      .eq('id', id)
      .eq('employee_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
