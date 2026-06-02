import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — load all reviews for the logged-in user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = await createServiceClient()
    const { data, error } = await serviceClient
      .from('reviews')
      .select('*')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reviews: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — upsert a review
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const serviceClient = await createServiceClient()
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
      updated_at: new Date().toISOString(),
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

    const { id } = await req.json()
    const serviceClient = await createServiceClient()
    const { error } = await serviceClient
      .from('reviews')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update specific fields (driveUrl, comparisonReport)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...fields } = await req.json()
    const serviceClient = await createServiceClient()
    const { error } = await serviceClient
      .from('reviews')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
