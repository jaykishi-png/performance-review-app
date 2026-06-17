'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()

  // Poll every 5s — if admin assigns a role or invite auto-applies, redirect immediately
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/auth/check-role', { cache: 'no-store' })
        const { role, redirect } = await res.json()
        if (role && role !== 'pending' && redirect) {
          router.replace(redirect)
        }
      } catch { /* ignore */ }
    }
    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [router])

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
          Your account is being set up.
        </p>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          If you received an invite link, please click it to activate your account instantly.
          Otherwise an administrator will assign your role shortly.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28, color: '#4b5563', fontSize: 13 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #1e2130', borderTop: '2px solid #4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Checking for access…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <a href="/api/auth/signout" style={{ padding: '10px 24px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
          Sign out
        </a>
      </div>
    </div>
  )
}
