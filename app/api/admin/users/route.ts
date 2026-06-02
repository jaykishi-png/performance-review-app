import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { userId, ...updates } = body

  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Prevent admin from demoting themselves
  if (userId === user.id && updates.role && updates.role !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log
  await serviceClient.from('audit_logs').insert({
    actor_user_id: user.id,
    action: 'user.update',
    target_type: 'user',
    target_id: userId,
    metadata: updates,
  })

  return NextResponse.json({ success: true })
}
