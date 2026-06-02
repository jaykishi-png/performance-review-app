import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRoleHomeRoute } from '@/lib/permissions'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Re-check role with service client — if it changed since login, redirect immediately
  const serviceClient = await createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'pending'
  if (role !== 'pending') redirect(getRoleHomeRoute(role))

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0d14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        padding: '48px 40px',
        background: '#13151f',
        border: '1px solid #1e2130',
        borderRadius: 16,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
        <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#f0f2fa' }}>
          Access Pending
        </h1>
        <p style={{ margin: '0 0 8px', fontSize: 15, color: '#9ca3af', lineHeight: 1.6 }}>
          You&apos;re signed in as <strong style={{ color: '#c4c9d4' }}>{user?.email}</strong>.
        </p>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          Your account is waiting for an administrator to assign your role.
          Once approved, you&apos;ll automatically get access.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #2a2d3e',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
