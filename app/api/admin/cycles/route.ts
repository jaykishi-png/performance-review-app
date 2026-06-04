import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (role !== 'admin' && role !== 'dev_admin') return null
  return { user, svc }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: cycles } = await auth.svc
    .from('review_cycles')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ cycles: cycles ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, sa_open, sa_close, review_open, review_close } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: cycle, error } = await auth.svc
    .from('review_cycles')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      sa_open: sa_open || null,
      sa_close: sa_close || null,
      review_open: review_open || null,
      review_close: review_close || null,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cycle })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, action, name, description, sa_open, sa_close, review_open, review_close } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  let updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (action === 'publish') {
    updates = { ...updates, status: 'active', published_at: new Date().toISOString() }
  } else if (action === 'close') {
    updates = { ...updates, status: 'closed', closed_at: new Date().toISOString() }
  } else if (action === 'reopen') {
    updates = { ...updates, status: 'active', closed_at: null }
  } else {
    if (name !== undefined) updates.name = name?.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (sa_open !== undefined) updates.sa_open = sa_open || null
    if (sa_close !== undefined) updates.sa_close = sa_close || null
    if (review_open !== undefined) updates.review_open = review_open || null
    if (review_close !== undefined) updates.review_close = review_close || null
  }

  const { data: cycle, error } = await auth.svc
    .from('review_cycles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cycle })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: existing } = await auth.svc
    .from('review_cycles')
    .select('status')
    .eq('id', id)
    .single()

  if ((existing as { status: string } | null)?.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft cycles can be deleted' }, { status: 400 })
  }

  await auth.svc.from('review_cycles').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
