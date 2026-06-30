import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getActorRole(userId: string): Promise<string> {
  const serviceClient = createServiceClient()
  const { data } = await serviceClient.from('profiles').select('role').eq('id', userId).single()
  return (data as { role: string } | null)?.role ?? 'pending'
}

export const dynamic = 'force-dynamic'

// GET — load reviews scoped by role. Pass ?id=xxx to fetch a single review with full form_data.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = await getActorRole(user.id)
    const serviceClient = createServiceClient()

    // Single-review fetch — returns full form_data; dev_admin gets form_data but no comparison_report/drive_url
    const singleId = new URL(req.url).searchParams.get('id')
    if (singleId) {
      const query = serviceClient
        .from('reviews')
        .select('id, user_id, employee_name, employee_position, step, max_step, form_data, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id')
        .eq('id', singleId)
      if (role === 'middle_manager') {
        // can access reviews they created OR reviews where they are the employee
        query.or(`user_id.eq.${user.id},employee_id.eq.${user.id}`)
      } else if (role !== 'admin' && role !== 'dev_admin') {
        query.eq('user_id', user.id)
      }
      const { data, error } = await query.single()
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found', code: error?.code, hint: error?.hint, role }, { status: 404 })
      if (role === 'dev_admin') {
        return NextResponse.json({ review: { ...(data as Record<string, unknown>), comparison_report: null, drive_url: null, _contentRedacted: true } })
      }
      return NextResponse.json({ review: data })
    }

    if (role === 'admin') {
      const { data, error } = await serviceClient.from('reviews').select('id, user_id, employee_name, employee_position, step, max_step, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id, admin_approved_at').order('saved_at', { ascending: false })
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

    // Middle manager: reviews they created (as manager) + reviews where they are the employee
    if (role === 'middle_manager') {
      const { data: mgrData, error: mgrErr } = await serviceClient
        .from('reviews')
        .select('id, user_id, employee_name, employee_position, step, max_step, form_data, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false })
      if (mgrErr) return NextResponse.json({ error: mgrErr.message }, { status: 500 })

      const { data: empData, error: empErr } = await serviceClient
        .from('reviews')
        .select('id, user_id, employee_name, employee_position, step, max_step, form_data, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id, admin_approved_at')
        .eq('employee_id', user.id)
        .not('manager_signed_at', 'is', null)
        .not('admin_approved_at', 'is', null)
        .order('updated_at', { ascending: false })
      if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 })

      return NextResponse.json({ reviews: mgrData ?? [], myReviews: empData ?? [] })
    }

    // Employee: fetch reviews where employee_id = user.id AND admin has approved
    if (role === 'employee') {
      const { data, error } = await serviceClient
        .from('reviews')
        .select('id, user_id, employee_name, employee_position, step, max_step, form_data, drive_url, drive_doc_id, comparison_report, saved_at, updated_at, manager_signed_at, employee_signed_at, manager_signature, employee_signature, employee_id, admin_approved_at')
        .eq('employee_id', user.id)
        .not('manager_signed_at', 'is', null)
        .not('admin_approved_at', 'is', null)
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
    // middle_manager acts as manager for creating/updating reviews of direct reports

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
