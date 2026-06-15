import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Public endpoint — no auth required. Token is the secret.
// GET /api/admin/invite/lookup?token=XXX
// Returns: { email, role, inviter_name } or 404/410
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const serviceClient = createServiceClient()

  const { data: invite, error } = await serviceClient
    .from('invites')
    .select('email, role, invited_by, expires_at, accepted_at')
    .eq('token', token)
    .single()

  if (error || !invite) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })

  const inv = invite as {
    email: string
    role: string
    invited_by: string
    expires_at: string
    accepted_at: string | null
  }

  if (inv.accepted_at) {
    return NextResponse.json({ error: 'This invite has already been accepted.' }, { status: 410 })
  }

  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired.' }, { status: 410 })
  }

  // Look up inviter name
  const { data: inviter } = await serviceClient
    .from('profiles')
    .select('name, email')
    .eq('id', inv.invited_by)
    .single()

  const inviterName = (inviter as { name: string | null; email: string } | null)?.name ||
    (inviter as { name: string | null; email: string } | null)?.email || 'Your Admin'

  const roleLabel =
    inv.role === 'admin' ? 'Administrator' :
    inv.role === 'manager' ? 'Manager' : 'Employee'

  return NextResponse.json({ email: inv.email, role: roleLabel, inviter_name: inviterName })
}
