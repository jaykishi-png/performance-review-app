'use client'

import { useRouter } from 'next/navigation'

export default function ForbiddenPage() {
  const router = useRouter()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'var(--page)', color: 'var(--text)',
      fontFamily: 'system-ui, sans-serif', gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Access Denied</h1>
      <p style={{ margin: 0, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 380 }}>
        You do not have permission to access this page. Contact your administrator if you believe this is a mistake.
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: 8, padding: '10px 24px', background: 'var(--brand)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 16, fontWeight: 600,
        }}
      >
        Go to my dashboard
      </button>
    </div>
  )
}
