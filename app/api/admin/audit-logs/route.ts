import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()

    const { data: actorProfile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const actorRole = (actorProfile as { role: string } | null)?.role
    if (actorRole !== 'admin' && actorRole !== 'dev_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: logs, error } = await serviceClient
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Collect unique actor_user_ids and target_ids for profile lookups
    const actorIds = [...new Set((logs ?? []).map((l: { actor_user_id: string }) => l.actor_user_id).filter(Boolean))]
    const targetUserIds = [...new Set(
      (logs ?? [])
        .filter((l: { target_type: string }) => l.target_type === 'user')
        .map((l: { target_id: string }) => l.target_id)
        .filter(Boolean)
    )]
    const allIds = [...new Set([...actorIds, ...targetUserIds])]

    let profileMap: Record<string, { name: string | null; email: string }> = {}
    if (allIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, name, email')
        .in('id', allIds)
      if (profiles) {
        profileMap = Object.fromEntries(
          (profiles as { id: string; name: string | null; email: string }[]).map(p => [p.id, { name: p.name, email: p.email }])
        )
      }
    }

    const enriched = (logs ?? []).map((log: {
      id: string
      actor_user_id: string
      action: string
      target_type: string
      target_id: string
      metadata: { changes?: Record<string, unknown>; actor_role?: string } | null
      created_at: string
    }) => ({
      ...log,
      actor_name: profileMap[log.actor_user_id]?.name ?? null,
      actor_email: profileMap[log.actor_user_id]?.email ?? null,
      target_name: log.target_type === 'user' && profileMap[log.target_id]
        ? (profileMap[log.target_id].name ?? profileMap[log.target_id].email)
        : null,
    }))

    return NextResponse.json({ logs: enriched })
  } catch (err) {
    console.error('[audit-logs GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
