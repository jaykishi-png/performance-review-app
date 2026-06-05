import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getActorRole(userId: string): Promise<string> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient.from('profiles').select('role').eq('id', userId).single()
  return (data as { role: string } | null)?.role ?? 'pending'
}

// GET — load reviews scoped by role
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = await getActorRole(user.id)
    const serviceClient = createServiceClient()

    if (role === 'admin') {
      const { data, error } = await serviceClient.from('reviews').select('id, user_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id').order('saved_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ reviews: data ?? [] })
    }

    // Dev admin: metadata only, content redacted
    if (role === 'dev_admin') {
      const { data, error } = await serviceClient
        .from('reviews')
        .select('id, user_id, employee_name, employee_position, step, max_step, saved_at, updated_at, drive_doc_id')
        .order('saved_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        reviews: (data ?? []).map(r => ({ ...r, form_data: null, comparison_report: null, _contentRedacted: true })),
      })
    }

    // Employee: fetch reviews where employee_id = user.id AND manager has signed
    if (role === 'employee') {
      const { data, error } = await serviceClient
        .from('reviews')
        .select('id, user_id, employee_name, employee_position, step, max_step, form_data, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id')
        .eq('employee_id', user.id)
        .not('manager_signed_at', 'is', null)
        .order('updated_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ reviews: data ?? [] })
    }

    // Manager: own reviews only
    const { data, error } = await serviceClient
      .from('reviews')
      .select('id, user_id, employee_name, employee_position, step, max_step, form_data, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reviews: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create/upsert a review
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = await getActorRole(user.id)
    if (role === 'dev_admin' || role === 'employee' || role === 'pending') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.from('reviews').upsert({
      id: body.id,
      user_id: user.id,
      employee_name: body.employeeName,
      employee_position: body.employeePosition,
      step: body.step,
      max_step: body.maxStep,
      saved_at: body.savedAt,
      form_data: body.form,
      drive_url: body.driveUrl ?? null,
      drive_doc_id: body.driveDocId ?? null,
      comparison_report: body.comparisonReport ?? null,
      updated_at: body.savedAt,
      employee_id: body.employeeId ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove a review
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = await getActorRole(user.id)
    if (role === 'dev_admin' || role === 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await req.json()
    const serviceClient = createServiceClient()
    const query = serviceClient.from('reviews').delete().eq('id', id)
    if (role !== 'admin') query.eq('user_id', user.id)
    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update specific fields
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = await getActorRole(user.id)
    if (role === 'dev_admin' || role === 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, ...fields } = await req.json()
    const serviceClient = createServiceClient()
    const query = serviceClient.from('reviews').update({ ...fields }).eq('id', id)
    if (role !== 'admin') query.eq('user_id', user.id)
    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
