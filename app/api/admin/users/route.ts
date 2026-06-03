import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DEV_ADMIN_FORBIDDEN_ROLES = ['admin', 'dev_admin']

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = await createServiceClient()
    const { data: actorProfile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const actorRole = (actorProfile as { role: string } | null)?.role
    if (actorRole !== 'admin' && actorRole !== 'dev_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, role, is_active, manager_id, start_date } = body

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Prevent changing own role
    if (userId === user.id && role && role !== actorRole) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    // Dev admin cannot assign admin or dev_admin roles
    if (actorRole === 'dev_admin' && role && DEV_ADMIN_FORBIDDEN_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Dev Admin cannot assign admin or dev_admin roles' }, { status: 403 })
    }

    const update: Record<string, unknown> = {}
    if (role !== undefined) update.role = role
    if (is_active !== undefined) update.is_active = is_active
    if (manager_id !== undefined) update.manager_id = manager_id
    if (start_date !== undefined) update.start_date = start_date

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await serviceClient.from('profiles').update(update).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Best-effort audit log
    serviceClient.from('audit_logs').insert({
      actor_user_id: user.id,
      action: role ? 'role_change' : is_active !== undefined ? 'activation_change' : 'user_update',
      target_type: 'user',
      target_id: userId,
      metadata: { changes: update, actor_role: actorRole },
    }).then(() => null, () => null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
