'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type DirectReport = {
  id: string; name: string | null; email: string; role: string; is_active: boolean; start_date: string | null
}
type Review = {
  id: string; employee_name: string; employee_position: string; step: number; max_step: number
  saved_at: string; updated_at: string; drive_url: string | null; drive_doc_id: string | null
}
type SelfAssessmentStatus = { employee_id: string; status: string; submitted_at: string | null }
type Props = {
  currentUser: { id: string; email: string; name: string | null; role: string }
  directReports: DirectReport[]
  reviews: Review[]
  selfAssessments: SelfAssessmentStatus[]
}

export default function ManagerDashboard({ currentUser, directReports, reviews, selfAssessments }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'team' | 'reviews'>('team')

  const saMap = Object.fromEntries(selfAssessments.map(s => [s.employee_id, s]))

  const card: React.CSSProperties = {
    background: '#1e293b', borderRadius: 12, padding: '20px 24px', border: '1px solid #1e3a5f',
  }
  const tab = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? '#6366f1' : 'transparent', color: active ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 14,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #1e3a5f', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#f1f5f9' }}>Manager Dashboard</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{currentUser.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/performance-review')}
            style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            + New Review
          </button>
          <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }}
            style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          <button style={tab(activeTab === 'team')} onClick={() => setActiveTab('team')}>My Team ({directReports.length})</button>
          <button style={tab(activeTab === 'reviews')} onClick={() => setActiveTab('reviews')}>Reviews ({reviews.length})</button>
        </div>

        {activeTab === 'team' && (
          directReports.length === 0 ? (
            <div style={{ ...card, color: '#475569', textAlign: 'center' }}>
              No direct reports assigned yet. Ask your admin to assign employees to your team.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {directReports.map(r => {
                const sa = saMap[r.id]
                return (
                  <div key={r.id} style={card}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{r.name || r.email}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{r.email}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, background: '#34d39922', color: '#34d399', fontSize: 11, fontWeight: 700 }}>Active</span>
                      {sa ? (
                        <span style={{ padding: '2px 8px', borderRadius: 99, background: sa.status === 'submitted' ? '#6366f122' : '#f59e0b22', color: sa.status === 'submitted' ? '#818cf8' : '#f59e0b', fontSize: 11, fontWeight: 700 }}>
                          Self-assessment: {sa.status}
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 99, background: '#47556922', color: '#64748b', fontSize: 11, fontWeight: 700 }}>No self-assessment</span>
                      )}
                    </div>
                    <button onClick={() => router.push('/performance-review')}
                      style={{ marginTop: 12, width: '100%', padding: '8px 0', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Start Review
                    </button>
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'reviews' && (
          <div style={card}>
            {reviews.length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center' }}>No reviews yet. Click + New Review to start.</div>
            ) : reviews.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.employee_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {r.employee_position} · Step {r.step}/{r.max_step} · Updated {new Date(r.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.drive_url && (
                    <a href={r.drive_url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '4px 10px', background: '#065f46', color: '#34d399', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      Drive
                    </a>
                  )}
                  <button onClick={() => router.push('/performance-review')}
                    style={{ padding: '4px 10px', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
