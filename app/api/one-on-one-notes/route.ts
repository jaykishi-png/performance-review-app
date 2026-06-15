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

// GET ?employee_id=UUID — fetch notes for an employee
export async function GET(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const employee_id = searchParams.get('employee_id')

  if (!employee_id) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const isPrivileged = role === 'admin' || role === 'dev_admin'

  let query = serviceClient
    .from('one_on_one_notes')
    .select('*')
    .eq('employee_id', employee_id)
    .order('meeting_date', { ascending: false })

  if (!isPrivileged) {
    query = query.eq('manager_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST — create note { employee_id, meeting_date, note, tags }
export async function POST(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { employee_id?: string; meeting_date?: string; note?: string; tags?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { employee_id, meeting_date, note, tags } = body

  if (!employee_id || !meeting_date || !note) {
    return NextResponse.json({ error: 'employee_id, meeting_date, and note are required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const { data, error } = await serviceClient
    .from('one_on_one_notes')
    .insert({
      employee_id,
      manager_id: user.id,
      meeting_date,
      note,
      tags: tags ?? [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// PATCH — update note { id, note?, tags?, meeting_date? }
export async function PATCH(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; note?: string; tags?: string[]; meeting_date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, note, tags, meeting_date } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const isPrivileged = role === 'admin' || role === 'dev_admin'

  // Verify ownership before updating
  const { data: existing, error: fetchError } = await serviceClient
    .from('one_on_one_notes')
    .select('manager_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  if (!isPrivileged && existing.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (note !== undefined) updates.note = note
  if (tags !== undefined) updates.tags = tags
  if (meeting_date !== undefined) updates.meeting_date = meeting_date

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await serviceClient
    .from('one_on_one_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE ?id=UUID — delete a note
export async function DELETE(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const isPrivileged = role === 'admin' || role === 'dev_admin'

  // Verify ownership before deleting
  const { data: existing, error: fetchError } = await serviceClient
    .from('one_on_one_notes')
    .select('manager_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  if (!isPrivileged && existing.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await serviceClient
    .from('one_on_one_notes')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
