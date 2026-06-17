import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRoleHomeRoute } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ role: null, redirect: '/login' })

  const serviceClient = createServiceClient()

  // Auto-apply any pending invite for this email (handles users who signed in before clicking their link)
  const { data: invite } = await serviceClient
    .from('invites')
    .select('id, role, manager_id, position, start_date')
    .eq('email', user.email!)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invite) {
    await serviceClient
      .from('profiles')
      .update({
        role: invite.role,
        ...(invite.manager_id ? { manager_id: invite.manager_id } : {}),
        ...(invite.position ? { position: invite.position } : {}),
        ...(invite.start_date ? { start_date: invite.start_date } : {}),
      })
      .eq('id', user.id)

    await serviceClient
      .from('invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    const route = getRoleHomeRoute(invite.role as any)
    return NextResponse.json({ role: invite.role, redirect: route })
  }

  // No invite — just return current role
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'pending'
  const route = role !== 'pending' ? getRoleHomeRoute(role as any) : null
  return NextResponse.json({ role, redirect: route })
}
