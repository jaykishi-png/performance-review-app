'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

type InviteInfo = {
  email: string
  role: string
  inviter_name: string
  error?: string
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const inviteToken = searchParams.get('invite')
  const next = searchParams.get('next') || ''

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!inviteToken) return
    fetch(`/api/admin/invite/lookup?token=${inviteToken}`)
      .then(r => r.json())
      .then((data: InviteInfo) => {
        if (data.error) {
          setInviteError(data.error)
        } else {
          setInvite(data)
        }
      })
      .catch(() => setInviteError('Could not load invite details.'))
      .finally(() => setInviteLoading(false))
  }, [inviteToken])

  async function signInWithGoogle() {
    const supabase = createClient()
    const callbackUrl = new URL(`${window.location.origin}/api/auth/callback`)
    if (next) callbackUrl.searchParams.set('next', next)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })
  }

  const isInviteFlow = !!inviteToken

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
        maxWidth: 420,
        padding: '48px 40px',
        background: '#13151f',
        border: '1px solid #1e2130',
        borderRadius: 16,
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 56,
          height: 56,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 24,
        }}>
          ⭐
        </div>

        {inviteLoading ? (
          // Loading state while fetching invite
          <>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#f0f2fa' }}>
              Performance Review
            </h1>
            <p style={{ margin: '0 0 36px', fontSize: 14, color: '#6b7280' }}>
              Loading your invitation…
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 24, height: 24, border: '2px solid #1e2130',
                borderTop: '2px solid #4f46e5', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </>
        ) : inviteError ? (
          // Invalid / expired invite
          <>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#f0f2fa' }}>
              Invite Link Issue
            </h1>
            <div style={{
              background: '#2d1515', border: '1px solid #5c2020',
              borderRadius: 8, padding: '12px 16px', margin: '0 0 24px',
              fontSize: 14, color: '#f87171', lineHeight: 1.5,
            }}>
              {inviteError}
            </div>
            <p style={{ margin: '0', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Contact your admin for a new invite link.
            </p>
          </>
        ) : isInviteFlow && invite ? (
          // Personalized invite experience
          <>
            {/* Invite badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)',
              borderRadius: 20, padding: '4px 12px', marginBottom: 20,
              fontSize: 12, fontWeight: 600, color: '#a5b4fc', letterSpacing: '0.03em',
            }}>
              <span>✉️</span> You&apos;ve been invited
            </div>

            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#f0f2fa', letterSpacing: '-0.3px' }}>
              Welcome to Performance Review
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9ca3af', lineHeight: 1.6 }}>
              <strong style={{ color: '#c4c9d4' }}>{invite.inviter_name}</strong> has invited you
              to join as a <strong style={{ color: '#c4c9d4' }}>{invite.role}</strong>.
            </p>

            {/* Email pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#0d0f1a', border: '1px solid #1e2130',
              borderRadius: 8, padding: '7px 14px', marginBottom: 28,
              fontSize: 13, color: '#6b7280',
            }}>
              <span style={{ color: '#34d399' }}>●</span>
              Sign in with <strong style={{ color: '#c4c9d4', marginLeft: 4 }}>{invite.email}</strong>
            </div>

            {error && (
              <div style={{
                background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8,
                padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f87171',
              }}>
                Authentication failed. Make sure you sign in with {invite.email}.
              </div>
            )}

            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%', padding: '13px 20px',
                background: '#fff', color: '#1a1a1a', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              <GoogleIcon />
              Accept Invitation with Google
            </button>

            <p style={{ marginTop: 20, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
              Use your <strong style={{ color: '#6b7280' }}>{invite.email}</strong> Google account.<br />
              This invite expires in 7 days.
            </p>
          </>
        ) : (
          // Standard login
          <>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#f0f2fa', letterSpacing: '-0.3px' }}>
              Performance Review
            </h1>
            <p style={{ margin: '0 0 36px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Sign in with your work Google account to continue
            </p>

            {error && (
              <div style={{
                background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8,
                padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f87171',
              }}>
                Authentication failed. Please try again.
              </div>
            )}

            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%', padding: '12px 20px',
                background: '#fff', color: '#1a1a1a', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              <GoogleIcon />
              Sign in with Google
            </button>

            <p style={{ marginTop: 28, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
              Access is managed by your organization.<br />
              Contact your admin if you need access.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
