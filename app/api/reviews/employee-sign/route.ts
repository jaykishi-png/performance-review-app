import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = (profile as { role: string } | null)?.role ?? 'pending'
    if (role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { reviewId: string; employeeSignature: string }
    const { reviewId, employeeSignature } = body

    // Fetch review where id=reviewId AND employee_id=user.id
    const { data: review, error: fetchError } = await serviceClient
      .from('reviews')
      .select('id, employee_signed_at')
      .eq('id', reviewId)
      .eq('employee_id', user.id)
      .single()
    if (fetchError || !review) {
      return NextResponse.json({ error: 'Review not found or not yours' }, { status: 403 })
    }

    if ((review as { id: string; employee_signed_at: string | null }).employee_signed_at) {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error: updateError } = await serviceClient
      .from('reviews')
      .update({ employee_signed_at: now, employee_signature: employeeSignature })
      .eq('id', reviewId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true, signedAt: now })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
