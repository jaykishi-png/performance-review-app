'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  name: string | null
  email: string
  role: string
  manager_id: string | null
}

type Manager = {
  name: string | null
  email: string
} | null

export default function EmployeePortal({ profile, manager }: { profile: Profile; manager: Manager }) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0d14',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#f0f2fa',
    }}>
      {/* Header */}
      <div style={{
        background: '#13151f',
        borderBottom: '1px solid #1e2130',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>⭐</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Performance Review</span>
          <span style={{
            background: '#1e2130', padding: '3px 10px', borderRadius: 20,
            fontSize: 12, color: '#60a5fa', fontWeight: 600,
          }}>Employee</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{profile.email}</span>
          <button
            onClick={signOut}
            style={{
              padding: '6px 14px', background: 'transparent',
              color: '#6b7280', border: '1px solid #2a2d3e',
              borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 32px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
          Welcome{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
        </h1>
        <p style={{ margin: '0 0 48px', fontSize: 16, color: '#6b7280' }}>
          Your performance review portal
        </p>

        {manager && (
          <div style={{
            background: '#13151f', border: '1px solid #1e2130',
            borderRadius: 12, padding: '20px 24px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              👤
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Your Manager</div>
              <div style={{ fontWeight: 600, color: '#e5e7eb' }}>{manager.name || manager.email}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{manager.email}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{
            background: '#13151f', border: '1px solid #1e2130',
            borderRadius: 12, padding: '28px',
            opacity: 0.6,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📝</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Self-Review</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Complete your annual self-evaluation
            </p>
            <div style={{
              display: 'inline-block', padding: '6px 14px',
              background: '#1e2130', borderRadius: 6,
              fontSize: 12, color: '#6b7280',
            }}>
              Coming soon
            </div>
          </div>

          <div style={{
            background: '#13151f', border: '1px solid #1e2130',
            borderRadius: 12, padding: '28px',
            opacity: 0.6,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>My Reviews</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              View your completed performance reviews
            </p>
            <div style={{
              display: 'inline-block', padding: '6px 14px',
              background: '#1e2130', borderRadius: 6,
              fontSize: 12, color: '#6b7280',
            }}>
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
