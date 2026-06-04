'use client'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ background: '#0b0d14', margin: 0, fontFamily: '-apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '32px 40px', maxWidth: 520, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f0f2fa' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            {error?.message || 'An unexpected error occurred.'}
          </p>
          {error?.digest && (
            <p style={{ margin: '0 0 20px', fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
              Digest: {error.digest}
            </p>
          )}
          <button onClick={() => window.location.reload()}
            style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
