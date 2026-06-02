import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
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

  const { email, role } = await request.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  // Upsert invite (replace if same email already has a pending invite)
  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await serviceClient
    .from('invites')
    .upsert({
      email,
      role,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
      accepted_at: null,
    }, { onConflict: 'email' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log
  await serviceClient.from('audit_logs').insert({
    actor_user_id: user.id,
    action: 'invite.create',
    target_type: 'invite',
    target_id: email,
    metadata: { role, email },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://performance-review-app-git-main-automation-7724s-projects.vercel.app'
  const inviteLink = `${appUrl}/login?invite=${token}`

  return NextResponse.json({ inviteLink })
}
