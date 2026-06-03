'use client'

import { useRouter } from 'next/navigation'

export default function ForbiddenPage() {
  const router = useRouter()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: '#0f172a', color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif', gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Access Denied</h1>
      <p style={{ margin: 0, color: '#94a3b8', textAlign: 'center', maxWidth: 380 }}>
        You do not have permission to access this page. Contact your administrator if you believe this is a mistake.
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: 8, padding: '10px 24px', background: '#6366f1', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600,
        }}
      >
        Go to my dashboard
      </button>
    </div>
  )
}
