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
    .from('employee_review_cycles')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ cycles: cycles ?? [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, phase } = body as { id: string; phase?: string }
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const VALID_PHASES = ['pending', 'sa_open', 'review_open', 'meeting', 'signed', 'complete']

  // Phase change request
  if (phase !== undefined) {
    if (!VALID_PHASES.includes(phase)) return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })

    const updates: Record<string, string> = { phase, updated_at: new Date().toISOString() }

    // When reopening the SA window, push sa_close_at 14 days out if it's in the past
    if (phase === 'sa_open') {
      const { data: existing } = await auth.svc
        .from('employee_review_cycles')
        .select('sa_open_at, sa_close_at')
        .eq('id', id)
        .single()
      const ec = existing as { sa_open_at: string | null; sa_close_at: string | null } | null
      const closeAt = ec?.sa_close_at ? new Date(ec.sa_close_at) : null
      if (!closeAt || closeAt < new Date()) {
        const newClose = new Date()
        newClose.setDate(newClose.getDate() + 14)
        updates.sa_close_at = newClose.toISOString().slice(0, 10)
        if (!ec?.sa_open_at) updates.sa_open_at = new Date().toISOString().slice(0, 10)
      }
    }

    const { data: cycle, error } = await auth.svc
      .from('employee_review_cycles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ cycle })
  }

  // Admin confirms a cycle complete (legacy — no phase field)
  const { data: cycle, error } = await auth.svc
    .from('employee_review_cycles')
    .update({
      admin_confirmed_at: new Date().toISOString(),
      confirmed_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cycle })
}
