'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Loader2, Send, Check, ChevronLeft, Users, FileText, AlertCircle } from 'lucide-react'

type DirectReport = {
  id: string; name: string | null; email: string; role: string; is_active: boolean; start_date: string | null
}
type Review = {
  id: string; employee_id: string | null; employee_name: string; employee_position: string
  step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null
  saved_at: string; updated_at: string; manager_signed_at: string | null; employee_signed_at: string | null
}
type SelfAssessmentStatus = { employee_id: string; status: string; submitted_at: string | null }
type Props = {
  currentUser: { id: string; email: string; name: string | null; role: string }
  directReports: DirectReport[]
  reviews: Review[]
  selfAssessments: SelfAssessmentStatus[]
}

type Goal = { id: string; title: string; description: string; status: string; target_date: string }

type GoalProgress = { id: string; title: string; checkin_status: 'on_track' | 'at_risk' | 'completed' | 'blocked' | ''; notes: string }

type CheckinData = {
  employee_pulse: number | null
  employee_update: string | null
  employee_goal_progress: GoalProgress[]
  employee_submitted_at: string | null
  manager_pulse: number | null
  manager_update: string | null
  manager_goal_progress: GoalProgress[]
  manager_submitted_at: string | null
}

const CI_YEAR = 2026
const QUARTERS = [{ label: 'Q1', n: 1 }, { label: 'Q2', n: 2 }, { label: 'Q3', n: 3 }, { label: 'Q4', n: 4 }]
const PULSE_EMOJIS: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }
const PULSE_LABELS = ['', 'Struggling', 'Below Expectations', 'On Track', 'Going Well', 'Thriving']
const PULSE_COLORS = ['', '#f87171', '#fb923c', '#fbbf24', '#34d399', '#34d399']
const GOAL_STATUSES: { value: GoalProgress['checkin_status']; label: string; color: string; bg: string }[] = [
  { value: 'on_track',  label: 'On Track',  color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  { value: 'completed', label: 'Completed', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  { value: 'at_risk',   label: 'At Risk',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  { value: 'blocked',   label: 'Blocked',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
]

export default function ManagerDashboard({ currentUser, directReports, reviews, selfAssessments }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'team' | 'reviews' | 'checkins'>('dashboard')

  // Check-ins state
  const [ciEmployee, setCiEmployee] = useState<DirectReport | null>(null)
  const [ciActiveQ, setCiActiveQ] = useState(1)
  const [ciLoading, setCiLoading] = useState(false)
  const [ciSaving, setCiSaving] = useState(false)
  const [ciSavedFlash, setCiSavedFlash] = useState(false)
  const [ciData, setCiData] = useState<CheckinData | null>(null)
  const [employeeGoals, setEmployeeGoals] = useState<Goal[]>([])
  // Manager's response fields
  const [mgrPulse, setMgrPulse] = useState(0)
  const [mgrUpdate, setMgrUpdate] = useState('')
  const [mgrGoalProgress, setMgrGoalProgress] = useState<GoalProgress[]>([])
  const [mgrSubmittedAt, setMgrSubmittedAt] = useState<string | null>(null)

  const saMap = Object.fromEntries(selfAssessments.map(s => [s.employee_id, s]))

  // ── Dashboard derived stats ────────────────────────────────────────────────
  const saSubmittedCount = selfAssessments.filter(s => s.status === 'submitted').length
  const reviewsInProgress = reviews.filter(r => !r.drive_url && r.step < r.max_step).length
  const reviewsComplete = reviews.filter(r => r.drive_url != null).length
  const reviewedEmployeeIds = new Set(reviews.map(r => r.employee_id).filter(Boolean))
  const saSubmittedIds = new Set(selfAssessments.filter(s => s.status === 'submitted').map(s => s.employee_id))
  const unreviewedEmployees = directReports.filter(dr => !reviewedEmployeeIds.has(dr.id))
  const pendingSignatureReviews = reviews.filter(r => r.manager_signed_at && !r.employee_signed_at)

  type ActionItem = { name: string; action: string; color: string; cta?: string; ctaFn?: () => void }
  const actionItems: ActionItem[] = [
    ...unreviewedEmployees.map(dr => ({
      name: dr.name || dr.email,
      action: saSubmittedIds.has(dr.id) ? 'Self-assessment submitted — ready for review' : 'No review started yet',
      color: saSubmittedIds.has(dr.id) ? '#6366f1' : '#f87171',
      cta: 'Start Review',
      ctaFn: () => router.push('/performance-review'),
    })),
    ...pendingSignatureReviews.map(r => ({
      name: r.employee_name,
      action: 'Waiting for employee signature',
      color: '#fbbf24',
    })),
  ]

  // Load check-in + goals when employee/quarter changes
  useEffect(() => {
    if (!ciEmployee) return
    let cancelled = false
    setCiLoading(true)
    setCiData(null)

    Promise.all([
      fetch(`/api/quarterly-checkins?employee_id=${ciEmployee.id}&year=${CI_YEAR}&quarter=${ciActiveQ}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/goals?employee_id=${ciEmployee.id}`).then(r => r.ok ? r.json() : null),
    ]).then(([ciJson, goalsJson]: [
      { data?: CheckinData | null } | null,
      { goals?: Goal[] } | null
    ]) => {
      if (cancelled) return
      const ci = ciJson?.data ?? null
      const goals = goalsJson?.goals ?? []
      setEmployeeGoals(goals)
      setCiData(ci)

      setMgrPulse(ci?.manager_pulse ?? 0)
      setMgrUpdate(ci?.manager_update ?? '')
      setMgrSubmittedAt(ci?.manager_submitted_at ?? null)

      const savedMgrProgress = ci?.manager_goal_progress ?? []
      setMgrGoalProgress(goals.map(g => {
        const saved = savedMgrProgress.find(s => s.id === g.id)
        return { id: g.id, title: g.title, checkin_status: (saved?.checkin_status ?? '') as GoalProgress['checkin_status'], notes: saved?.notes ?? '' }
      }))
      setCiLoading(false)
    }).catch(() => { if (!cancelled) setCiLoading(false) })

    return () => { cancelled = true }
  }, [ciEmployee, ciActiveQ])

  async function saveMgrDraft() {
    if (!ciEmployee) return
    setCiSaving(true)
    await fetch('/api/quarterly-checkins', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: ciEmployee.id, manager_id: currentUser.id, year: CI_YEAR, quarter: ciActiveQ, type: 'manager', pulse_rating: mgrPulse, written_update: mgrUpdate, goal_progress: mgrGoalProgress, status: 'draft' })
    })
    setCiSaving(false); setCiSavedFlash(true); setTimeout(() => setCiSavedFlash(false), 2000)
  }

  async function submitMgrCheckin() {
    if (!ciEmployee) return
    setCiSaving(true)
    const res = await fetch('/api/quarterly-checkins', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: ciEmployee.id, manager_id: currentUser.id, year: CI_YEAR, quarter: ciActiveQ, type: 'manager', pulse_rating: mgrPulse, written_update: mgrUpdate, goal_progress: mgrGoalProgress, status: 'submitted' })
    })
    const json = await res.json()
    setCiSaving(false)
    setMgrSubmittedAt(json.data?.manager_submitted_at ?? new Date().toISOString())
  }

  const card: React.CSSProperties = {
    background: '#1e293b', borderRadius: 12, padding: '20px 24px', border: '1px solid #1e3a5f',
  }
  const tab = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? '#6366f1' : 'transparent', color: active ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 14,
  })
  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{text}</div>
  )

  const statCard = (label: string, value: React.ReactNode, sub: string, accent: string) => (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', border: '1px solid #1e3a5f' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: accent, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #1e3a5f', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#f1f5f9' }}>Manager Portal</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{currentUser.name || currentUser.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/performance-review')}
            style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            + New Review
          </button>
          <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }}
            style={{ padding: '8px 16px', background: 'transparent', color: '#94a3b8', border: '1px solid #1e3a5f', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#1e293b', padding: 4, borderRadius: 10, border: '1px solid #1e3a5f', width: 'fit-content' }}>
          <button style={tab(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button style={tab(activeTab === 'team')} onClick={() => setActiveTab('team')}>My Team ({directReports.length})</button>
          <button style={tab(activeTab === 'reviews')} onClick={() => setActiveTab('reviews')}>Reviews ({reviews.length})</button>
          <button style={tab(activeTab === 'checkins')} onClick={() => { setActiveTab('checkins'); setCiEmployee(null) }}>Quarterly Check-ins</button>
        </div>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Welcome */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>
                Welcome back{currentUser.name ? `, ${currentUser.name.split(' ')[0]}` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Here&apos;s your team&apos;s performance overview
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {statCard(
                'Team Size',
                <span style={{ color: '#f1f5f9' }}>{directReports.length}</span>,
                'Active employees',
                '#f1f5f9'
              )}
              {statCard(
                'Self-Assessments',
                <>
                  <span style={{ color: saSubmittedCount > 0 ? '#34d399' : '#f1f5f9' }}>{saSubmittedCount}</span>
                  <span style={{ fontSize: 16, color: '#475569', fontWeight: 600 }}>/{directReports.length}</span>
                </>,
                'Submitted this cycle',
                '#34d399'
              )}
              {statCard(
                'In Progress',
                <span style={{ color: reviewsInProgress > 0 ? '#fbbf24' : '#f1f5f9' }}>{reviewsInProgress}</span>,
                'Reviews underway',
                '#fbbf24'
              )}
              {statCard(
                'Completed',
                <span style={{ color: reviewsComplete > 0 ? '#818cf8' : '#f1f5f9' }}>{reviewsComplete}</span>,
                'Reviews finalized',
                '#818cf8'
              )}
            </div>

            {/* Action Items + Team Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

              {/* Action Items */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <AlertCircle size={16} color="#fbbf24" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Action Items</div>
                  {actionItems.length > 0 && (
                    <span style={{ padding: '1px 7px', borderRadius: 99, background: '#fbbf2420', color: '#fbbf24', fontSize: 11, fontWeight: 700, marginLeft: 'auto' }}>
                      {actionItems.length}
                    </span>
                  )}
                </div>
                {actionItems.length === 0 ? (
                  <div style={{ color: '#34d399', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                    <CheckCircle2 size={16} /> All caught up — nothing pending!
                  </div>
                ) : actionItems.map((item, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < actionItems.length - 1 ? '1px solid #1e3a5f' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.action}</div>
                    </div>
                    {item.cta && item.ctaFn && (
                      <button onClick={item.ctaFn} style={{ padding: '4px 10px', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                        {item.cta}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Team Overview */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Users size={16} color="#6366f1" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Team Overview</div>
                </div>
                {directReports.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 13, padding: '12px 0' }}>
                    No direct reports assigned yet. Ask your admin to assign employees.
                  </div>
                ) : directReports.map((dr, i) => {
                  const sa = saMap[dr.id]
                  const rev = reviews.find(r => r.employee_id === dr.id)
                  return (
                    <div key={dr.id} style={{ padding: '10px 0', borderBottom: i < directReports.length - 1 ? '1px solid #1e3a5f' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dr.name || dr.email}</div>
                        <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dr.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {sa ? (
                          <span style={{ padding: '2px 7px', borderRadius: 99, background: sa.status === 'submitted' ? '#6366f122' : '#f59e0b22', color: sa.status === 'submitted' ? '#818cf8' : '#f59e0b', fontSize: 10, fontWeight: 700 }}>
                            SA {sa.status}
                          </span>
                        ) : (
                          <span style={{ padding: '2px 7px', borderRadius: 99, background: '#47556922', color: '#64748b', fontSize: 10, fontWeight: 700 }}>No SA</span>
                        )}
                        {rev ? (
                          <span style={{ padding: '2px 7px', borderRadius: 99, background: rev.drive_url ? '#34d39922' : '#fbbf2422', color: rev.drive_url ? '#34d399' : '#fbbf24', fontSize: 10, fontWeight: 700 }}>
                            {rev.drive_url ? 'Done' : `Step ${rev.step}/${rev.max_step}`}
                          </span>
                        ) : (
                          <span style={{ padding: '2px 7px', borderRadius: 99, background: '#f8711122', color: '#fb923c', fontSize: 10, fontWeight: 700 }}>No Review</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Reviews */}
            {reviews.length > 0 && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} color="#6366f1" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Recent Reviews</div>
                  </div>
                  <button onClick={() => setActiveTab('reviews')} style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                </div>
                {reviews.slice(0, 5).map((r, i) => (
                  <div key={r.id} style={{ padding: '12px 0', borderBottom: i < Math.min(reviews.length, 5) - 1 ? '1px solid #1e3a5f' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{r.employee_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {r.employee_position} · Step {r.step}/{r.max_step} · {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {r.manager_signed_at && !r.employee_signed_at && (
                        <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2420', border: '1px solid #fbbf2440', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Awaiting Signature</span>
                      )}
                      {r.employee_signed_at && (
                        <span style={{ fontSize: 10, color: '#34d399', background: '#34d39920', border: '1px solid #34d39940', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Signed</span>
                      )}
                      {r.drive_url && (
                        <a href={r.drive_url} target="_blank" rel="noopener noreferrer" style={{ padding: '3px 8px', background: '#065f46', color: '#34d399', borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                          Drive
                        </a>
                      )}
                      <button onClick={() => router.push('/performance-review')}
                        style={{ padding: '3px 10px', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state when no reviews or team */}
            {reviews.length === 0 && directReports.length > 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>No reviews yet</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Start a performance review for one of your team members.</div>
                <button onClick={() => router.push('/performance-review')}
                  style={{ padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  + New Review
                </button>
              </div>
            )}

            {directReports.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>No team members yet</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Ask your admin to assign employees to your team.</div>
              </div>
            )}
          </div>
        )}

        {/* ── MY TEAM ── */}
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

        {/* ── REVIEWS ── */}
        {activeTab === 'reviews' && (
          <div style={card}>
            {reviews.length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center' }}>No reviews yet. Click + New Review to start.</div>
            ) : reviews.map((r, i) => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: i < reviews.length - 1 ? '1px solid #1e3a5f' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

        {/* ── QUARTERLY CHECK-INS ── */}
        {activeTab === 'checkins' && (
          <div>
            {!ciEmployee ? (
              <div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>Select a team member to view or fill in their quarterly check-in.</div>
                {directReports.length === 0 ? (
                  <div style={{ ...card, color: '#475569', textAlign: 'center' }}>No direct reports assigned yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {directReports.map(r => (
                      <button key={r.id} onClick={() => setCiEmployee(r)}
                        style={{ ...card, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #1e3a5f', transition: 'border-color 0.15s' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{r.name || r.email}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.email}</div>
                        </div>
                        <div style={{ fontSize: 20, color: '#475569' }}>→</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Back + header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button onClick={() => setCiEmployee(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 16 }}>{ciEmployee.name || ciEmployee.email}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Quarterly Check-in · {CI_YEAR}</div>
                  </div>
                </div>

                {/* Quarter tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                  {QUARTERS.map(q => (
                    <button key={q.n} onClick={() => setCiActiveQ(q.n)}
                      style={{ padding: '7px 18px', borderRadius: 8, border: `1px solid ${ciActiveQ === q.n ? '#6366f1' : '#1e3a5f'}`, background: ciActiveQ === q.n ? '#6366f1' : 'transparent', color: ciActiveQ === q.n ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {q.label}
                    </button>
                  ))}
                </div>

                {ciLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 13 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                    {/* ── LEFT: Employee's check-in (read-only) ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ ...card, background: '#13151f', border: '1px solid #1e2130' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                            {ciEmployee.name?.split(' ')[0] || 'Employee'}&apos;s Check-in
                          </h3>
                          {ciData?.employee_submitted_at ? (
                            <span style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> {new Date(ciData.employee_submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} /> Not submitted
                            </span>
                          )}
                        </div>

                        {ciData?.employee_submitted_at ? (
                          <>
                            {ciData.employee_pulse !== null && (
                              <div style={{ marginBottom: 16 }}>
                                {sectionLabel('Performance pulse')}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 22 }}>{PULSE_EMOJIS[ciData.employee_pulse]}</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: PULSE_COLORS[ciData.employee_pulse] }}>{PULSE_LABELS[ciData.employee_pulse]}</span>
                                </div>
                              </div>
                            )}
                            {ciData.employee_update && (
                              <div>
                                {sectionLabel('Update')}
                                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{ciData.employee_update}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ color: '#475569', fontSize: 13 }}>Employee hasn&apos;t submitted their check-in yet.</div>
                        )}
                      </div>

                      {/* Employee goal progress */}
                      <div style={{ ...card, background: '#13151f', border: '1px solid #1e2130' }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                          {ciEmployee.name?.split(' ')[0] || 'Employee'}&apos;s Goal Progress
                        </h3>
                        {employeeGoals.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>No goals set.</div>
                        ) : employeeGoals.map((g, gi) => {
                          const savedProgress = (ciData?.employee_goal_progress ?? []).find(p => p.id === g.id)
                          const statusMeta = GOAL_STATUSES.find(s => s.value === savedProgress?.checkin_status)
                          return (
                            <div key={g.id} style={{ marginBottom: gi < employeeGoals.length - 1 ? 14 : 0, paddingBottom: gi < employeeGoals.length - 1 ? 14 : 0, borderBottom: gi < employeeGoals.length - 1 ? '1px solid #1e2130' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.4 }}>{g.title}</div>
                                {statusMeta ? (
                                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, flexShrink: 0, background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                                )}
                              </div>
                              {savedProgress?.notes && (
                                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{savedProgress.notes}</p>
                              )}
                              <div style={{ marginTop: 4, fontSize: 11, color: '#475569' }}>
                                {g.target_date && `Target: ${g.target_date}`}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── RIGHT: Manager's response ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ ...card, background: '#13151f', border: '1px solid #1e2130' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>My Response</h3>
                          {mgrSubmittedAt && (
                            <span style={{ fontSize: 11, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> Submitted {new Date(mgrSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {sectionLabel('My performance assessment')}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                          {[1,2,3,4,5].map(n => (
                            <button key={n} onClick={() => { if (!mgrSubmittedAt) setMgrPulse(n) }}
                              style={{ width: 44, height: 44, borderRadius: 9, border: `2px solid ${mgrPulse === n ? '#6366f1' : '#1e3a5f'}`, background: mgrPulse === n ? 'rgba(99,102,241,0.18)' : 'transparent', fontSize: 20, cursor: mgrSubmittedAt ? 'default' : 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={`${n} — ${PULSE_LABELS[n]}`}>
                              {PULSE_EMOJIS[n]}
                            </button>
                          ))}
                        </div>
                        {mgrPulse > 0 && <div style={{ fontSize: 12, color: PULSE_COLORS[mgrPulse], fontWeight: 600, marginBottom: 16 }}>{PULSE_LABELS[mgrPulse]}</div>}
                        {mgrPulse === 0 && <div style={{ marginBottom: 16 }} />}

                        {sectionLabel('Notes to employee')}
                        <textarea value={mgrUpdate} onChange={e => { if (!mgrSubmittedAt) setMgrUpdate(e.target.value) }}
                          disabled={!!mgrSubmittedAt} placeholder="Share your observations, feedback, and any priorities for next quarter…"
                          rows={4} style={{ width: '100%', background: '#0d0f1a', border: '1px solid #1e2130', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', opacity: mgrSubmittedAt ? 0.6 : 1 }} />

                        {!mgrSubmittedAt && (
                          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button onClick={saveMgrDraft} disabled={ciSaving}
                              style={{ padding: '8px 18px', background: 'transparent', color: ciSavedFlash ? '#34d399' : '#94a3b8', border: `1px solid ${ciSavedFlash ? '#34d399' : '#1e3a5f'}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {ciSavedFlash ? <><Check size={12} /> Saved</> : ciSaving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save Draft'}
                            </button>
                            <button onClick={submitMgrCheckin} disabled={ciSaving || mgrPulse === 0}
                              style={{ padding: '8px 20px', background: mgrPulse === 0 ? '#1e3a5f' : '#6366f1', color: mgrPulse === 0 ? '#475569' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: mgrPulse === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Send size={12} /> Submit Response
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Manager goal assessment */}
                      {employeeGoals.length > 0 && (
                        <div style={{ ...card, background: '#13151f', border: '1px solid #1e2130' }}>
                          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>My Goal Assessment</h3>
                          {mgrGoalProgress.map((g, gi) => (
                            <div key={g.id} style={{ marginBottom: gi < mgrGoalProgress.length - 1 ? 16 : 0, paddingBottom: gi < mgrGoalProgress.length - 1 ? 16 : 0, borderBottom: gi < mgrGoalProgress.length - 1 ? '1px solid #1e2130' : 'none' }}>
                              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{g.title}</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                {GOAL_STATUSES.map(s => (
                                  <button key={s.value} onClick={() => { if (!mgrSubmittedAt) setMgrGoalProgress(prev => prev.map((p, i) => i === gi ? { ...p, checkin_status: s.value } : p)) }}
                                    style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: mgrSubmittedAt ? 'default' : 'pointer', border: `1px solid ${g.checkin_status === s.value ? s.color : 'transparent'}`, background: g.checkin_status === s.value ? s.bg : '#0d0f1a', color: g.checkin_status === s.value ? s.color : '#475569', transition: 'all 0.15s' }}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                              <textarea value={g.notes} onChange={e => { if (!mgrSubmittedAt) setMgrGoalProgress(prev => prev.map((p, i) => i === gi ? { ...p, notes: e.target.value } : p)) }}
                                disabled={!!mgrSubmittedAt} placeholder="Notes on this goal…" rows={2}
                                style={{ width: '100%', background: '#0d0f1a', border: '1px solid #1e2130', borderRadius: 7, padding: '8px 10px', color: mgrSubmittedAt ? '#475569' : '#e2e8f0', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
