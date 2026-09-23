'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, FileText, BookOpen, BookMarked,
  Send, LogOut, CheckCircle2, Star, Plus, X, Loader2,
  ExternalLink, Bell, Target, User, ChevronDown,
  BarChart2, History, Pencil, Check, Sparkles,
  ClipboardCheck, MessagesSquare, ClipboardList, ArrowLeft,
} from 'lucide-react'
import { useCompetencies } from '@/lib/use-competencies'
import { SignaturePad, SignatureDisplay, encodeSignature, decodeSignature, type SignatureResult } from '@/components/SignaturePad'
import { CalibrIcon, CalibrLogo, ThemeToggle } from '@/components/Brand'
import { EmptyState, Button as CButton } from '@/components/calibr'

// ── Types ─────────────────────────────────────────────────────────────────────

type Page = 'self-assessment' | 'reviews' | 'timeline' | 'goals' | 'guide' | 'glossary' | 'pip'

type KeyResult = {
  id: string
  title: string
  type: 'percent' | 'number' | 'currency' | 'boolean'
  current: number
  target: number
  unit?: string
}

type Goal = {
  id: string
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'complete'
  target_date: string
  notes: string
  created_at: string
  key_results: KeyResult[]
}
type CompetencyType = 'positive' | 'constructive' | 'choice'
type Competency = { type: CompetencyType; term: string; examples: [string, string, string] }
type GoalItem = { description: string; outcome: 'successful' | 'unsuccessful' | 'ongoing' | ''; reasoning: string }
type NextYearGoal = { goal: string; objective: string }

type SelfReview = {
  id?: string
  competencies: Competency[]
  goals_objectives: GoalItem[]
  next_year_goals: NextYearGoal[]
  overall_rating: number | null
  status: 'draft' | 'submitted'
  submitted_at?: string | null
  strengths?: string
  growth_areas?: string
  overall_comments?: string
}

type Profile = { id: string; name: string | null; email: string; role: string; manager_id: string | null; position: string | null }
type Manager = { name: string | null; email: string } | null

// ── Static data ───────────────────────────────────────────────────────────────


const STAR_LABELS: Record<number, { label: string; description: string; color: string }> = {
  5: { label: 'Outstanding',              description: 'Consistently exceeds performance requirements.',                               color: 'var(--brand-text)' },
  4: { label: 'Exceeds Job Requirements', description: 'Meets and at times exceeds performance requirements (above average).',          color: 'var(--success)' },
  3: { label: 'Meets Expectations',       description: 'Job requirements are being met at a satisfactory level.',                      color: 'var(--warning)' },
  2: { label: 'Needs Improvement',        description: 'Does not consistently meet the expected job requirements.',                    color: 'var(--warning)' },
  1: { label: 'Unsatisfactory',           description: 'Demonstrates an unacceptable level of skills and competencies.',               color: 'var(--danger)' },
}

const COMP_CONFIG: { type: CompetencyType; label: string; sublabel: string; accent: string }[] = [
  { type: 'positive',     label: 'Competency 1', sublabel: 'Positive',     accent: 'var(--success)' },
  { type: 'positive',     label: 'Competency 2', sublabel: 'Positive',     accent: 'var(--success)' },
  { type: 'constructive', label: 'Competency 3', sublabel: 'Constructive', accent: 'var(--warning)' },
  { type: 'constructive', label: 'Competency 4', sublabel: 'Constructive', accent: 'var(--warning)' },
  { type: 'choice',       label: 'Competency 5', sublabel: 'Your Choice',  accent: 'var(--brand)' },
]

const SA_STEPS = [
  { id: 'info',   label: 'Info',         short: 'Info'   },
  { id: 'comp1',  label: 'Competency 1', short: 'C1'     },
  { id: 'comp2',  label: 'Competency 2', short: 'C2'     },
  { id: 'comp3',  label: 'Competency 3', short: 'C3'     },
  { id: 'comp4',  label: 'Competency 4', short: 'C4'     },
  { id: 'comp5',  label: 'Competency 5', short: 'C5'     },
  { id: 'goals',  label: 'Goals',        short: 'Goals'  },
  { id: 'next',   label: 'Next Year',    short: 'Next'   },
  { id: 'export', label: 'Export',       short: 'Export' },
]

const NAV_ITEMS: { id: Page; label: string; icon: React.FC<{ size: number; color?: string }> }[] = [
  { id: 'self-assessment', label: 'Self Assessment',      icon: ClipboardCheck },
  { id: 'reviews',         label: 'Performance Review Meeting', icon: MessagesSquare },
  { id: 'timeline',        label: 'Review Timeline',      icon: History    },
  { id: 'goals',           label: 'Goals Tracker',        icon: Target     },
  { id: 'pip',             label: 'Coaching Plan',        icon: ClipboardList },
  { id: 'guide',           label: 'Employee Guide',       icon: BookOpen   },
  { id: 'glossary',        label: 'Competency Glossary',  icon: BookMarked },
]

// ── Default state ─────────────────────────────────────────────────────────────

function makeDefault(): SelfReview {
  return {
    competencies: COMP_CONFIG.map(c => ({ type: c.type, term: '', examples: ['', '', ''] })),
    goals_objectives: [
      { description: '', outcome: '', reasoning: '' },
      { description: '', outcome: '', reasoning: '' },
      { description: '', outcome: '', reasoning: '' },
    ],
    next_year_goals: [{ goal: '', objective: '' }, { goal: '', objective: '' }],
    overall_rating: null,
    status: 'draft',
  }
}

function mergeReview(saved: Partial<SelfReview> | null): SelfReview {
  const d = makeDefault()
  if (!saved) return d
  return {
    ...d, ...saved,
    competencies:    saved.competencies?.length    ? saved.competencies    : d.competencies,
    goals_objectives: saved.goals_objectives?.length ? saved.goals_objectives : d.goals_objectives,
    next_year_goals:  saved.next_year_goals?.length  ? saved.next_year_goals  : d.next_year_goals,
  }
}

function isStepComplete(stepIdx: number, r: SelfReview, driveUrl?: string | null): boolean {
  switch (stepIdx) {
    case 0: return true
    case 1: case 2: case 3: case 4:
      return !!(r.competencies[stepIdx - 1]?.term && r.competencies[stepIdx - 1]?.examples[0]?.trim())
    case 5: {
      const c5 = r.competencies[4]
      return !!(c5?.term && c5?.examples[0]?.trim() && (c5?.type === 'positive' || c5?.type === 'constructive'))
    }
    case 6: return !!(r.goals_objectives.some(g => g.description.trim()) && r.overall_rating)
    case 7: return r.next_year_goals.some(g => g.goal.trim())
    case 8: return !!driveUrl
    default: return false
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

type ActiveCycle = {
  id: string; phase: string; sa_open_at: string; sa_close_at: string
  review_open_at: string; review_close_at: string; meeting_open_at: string; meeting_close_at: string
  trigger_date: string; anniversary_year: number
} | null

type Props = {
  profile: Profile
  position?: string | null
  manager: Manager
  initialSelfReview: Partial<SelfReview> | null
  initialDriveUrl?: string | null
  selfReviewId?: string | null
  activeCycle?: ActiveCycle
  unreadCount?: number
  initialPage?: string
}

// ── PIP / Coaching Plan (must be top-level to use hooks) ─────────────────────

function EmployeePipPanel() {
  const [pipPlans, setPipPlans] = useState<any[]>([])
  const [pipLoading, setPipLoading] = useState(true)
  const [pipNote, setPipNote] = useState('')
  const [pipSaving, setPipSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pip-plans').then(r => r.json()).then(d => { setPipPlans(d.data || []); setPipLoading(false) }).catch(() => setPipLoading(false))
  }, [])

  const activePip = pipPlans.find(p => p.status === 'active') || pipPlans[0]
  const sCard: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 16 }
  const statusColor: Record<string, string> = { active: 'var(--info)', completed: 'var(--success)', escalated: 'var(--danger)', withdrawn: 'var(--text-muted)' }
  const statusBg: Record<string, string> = { active: 'var(--info-bg)', completed: 'var(--success-bg)', escalated: 'var(--danger-bg)', withdrawn: 'var(--surface)' }

  if (pipLoading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Coaching Plan</h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)' }}>Your active performance improvement or coaching plan.</p>

      {pipPlans.length === 0 ? (
        <div style={{ ...sCard, textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No active coaching plan</div>
          <div style={{ fontSize: 13 }}>You don&apos;t have any active PIPs or coaching plans at this time.</div>
        </div>
      ) : (
        <>
          {activePip && (
            <>
              <div style={sCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 4 }}>{activePip.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Started {new Date(activePip.start_date).toLocaleDateString()} · Target {new Date(activePip.target_date).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, background: statusBg[activePip.status], color: statusColor[activePip.status] }}>
                    {activePip.status.charAt(0).toUpperCase() + activePip.status.slice(1)}
                  </span>
                </div>

                {activePip.reason && (
                  <div style={{ background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {activePip.reason}
                  </div>
                )}

                {!activePip.employee_acknowledged && activePip.status === 'active' && (
                  <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--warning-text)' }}>Please acknowledge you have received and reviewed this plan.</span>
                    <button disabled={pipSaving} onClick={async () => {
                      setPipSaving(true)
                      await fetch('/api/pip-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activePip.id, employee_acknowledged: true }) })
                      setPipPlans(prev => prev.map(p => p.id === activePip.id ? { ...p, employee_acknowledged: true } : p))
                      setPipSaving(false)
                    }} style={{ padding: '6px 14px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {pipSaving ? 'Saving…' : '✓ Acknowledge'}
                    </button>
                  </div>
                )}
                {activePip.employee_acknowledged && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginBottom: 12 }}>
                    ✓ Acknowledged {activePip.employee_acknowledged_at ? new Date(activePip.employee_acknowledged_at).toLocaleDateString() : ''}
                  </div>
                )}
              </div>

              {/* Milestones */}
              <div style={sCard}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Milestones</div>
                {(activePip.milestones as any[]).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No milestones set.</div>
                ) : (
                  (activePip.milestones as any[]).map((m: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: m.completed ? 'var(--success)' : 'var(--border)', border: `2px solid ${m.completed ? 'var(--success)' : 'var(--border)'}`, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: m.completed ? 'var(--text-faint)' : 'var(--text)', textDecoration: m.completed ? 'line-through' : 'none' }}>{m.text}</span>
                      {m.due_date && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{new Date(m.due_date).toLocaleDateString()}</span>}
                    </div>
                  ))
                )}
              </div>

              {/* Employee notes */}
              <div style={sCard}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>My Notes</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={pipNote} onChange={e => setPipNote(e.target.value)} placeholder="Add a note…"
                    style={{ flex: 1, background: 'var(--surface-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                  <button disabled={!pipNote || pipSaving} onClick={async () => {
                    setPipSaving(true)
                    const notes = [...((activePip.check_in_notes as any[]) || []), { text: pipNote, date: new Date().toISOString(), by: 'employee' }]
                    await fetch('/api/pip-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activePip.id, check_in_notes: notes }) })
                    setPipPlans(prev => prev.map(p => p.id === activePip.id ? { ...p, check_in_notes: notes } : p))
                    setPipNote('')
                    setPipSaving(false)
                  }} style={{ padding: '8px 16px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !pipNote || pipSaving ? 0.5 : 1 }}>
                    Add
                  </button>
                </div>
                {((activePip.check_in_notes as any[]) || []).filter((n: any) => n.by === 'employee').length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Notes your manager shares will appear here.</div>
                ) : (
                  [...((activePip.check_in_notes as any[]) || [])].filter((n: any) => n.by === 'employee').reverse().map((n: any, i: number) => (
                    <div key={i} style={{ background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{new Date(n.date).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeePortal({ profile, position, manager, initialSelfReview, initialDriveUrl, selfReviewId, activeCycle = null, unreadCount = 0, initialPage }: Props) {
  // Admin-managed list; aliased to the { term, definition } shape used below.
  const COMPETENCY_TERMS = useCompetencies().map(c => ({ term: c.name, definition: c.definition }))
  const router = useRouter()
  const [page, setPage] = useState<Page>((initialPage as Page) ?? 'self-assessment')
  const [collapsed, setCollapsed] = useState(false)
  const [step, setStep] = useState(0)
  const [review, setReview] = useState<SelfReview>(() => mergeReview(initialSelfReview))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [driveUrl, setDriveUrl] = useState<string | null>(initialDriveUrl ?? null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showManualLink, setShowManualLink] = useState(false)
  const [manualLinkValue, setManualLinkValue] = useState('')
  const [manualLinkError, setManualLinkError] = useState('')
  const [manualLinkSaving, setManualLinkSaving] = useState(false)
  const [goalsImportMsg, setGoalsImportMsg] = useState<string | null>(null)

  async function saveManualDriveLink() {
    const val = manualLinkValue.trim()
    if (!val) { setManualLinkError('Please enter a URL.'); return }
    if (!val.startsWith('https://docs.google.com/') && !val.startsWith('https://drive.google.com/')) {
      setManualLinkError('Must be a Google Docs or Drive URL.')
      return
    }
    setManualLinkSaving(true)
    try {
      await fetch('/api/self-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_url: val }),
      })
      setDriveUrl(val)
      setShowManualLink(false)
      setManualLinkValue('')
      setManualLinkError('')
    } finally {
      setManualLinkSaving(false)
    }
  }
  const [approved, setApproved] = useState(false)
  const [glossarySearch, setGlossarySearch] = useState('')
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [profileName, setProfileName] = useState(profile.name || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  // Goals
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', status: 'not_started' as Goal['status'], target_date: '', notes: '' })
  const [goalSaving, setGoalSaving] = useState(false)
  const [krAddingId, setKrAddingId] = useState<string | null>(null)
  const [krForm, setKrForm] = useState({ title: '', type: 'percent' as KeyResult['type'], current: '', target: '', unit: '' })
  const [krSaving, setKrSaving] = useState(false)
  const [krExpandedIds, setKrExpandedIds] = useState<Set<string>>(new Set())
  // Notifications
  const [showNotifications, setShowNotifications] = useState(false)
  // Scheduled review meeting — metadata only; the review itself stays gated
  const [upcomingMeeting, setUpcomingMeeting] = useState<{ id: string; meeting_scheduled_at: string; meeting_location: string | null } | null>(null)
  const [managerReviews, setManagerReviews] = useState<Array<{
    id: string
    employee_name: string
    employee_position: string
    overall_score: number | null
    drive_url: string | null
    manager_signed_at: string
    manager_signature: string
    employee_signed_at: string | null
    employee_signature: string | null
    updated_at: string
    comparison_report?: string | null
    form_data?: {
      goals?: Array<{ text: string; status: string; explanation?: string }>
      nextGoals?: Array<{ text: string; targetDate?: string }>
      overallScore?: number
      overallSummary?: string
      supervisorName?: string
      competencyOne?: { competency: string; examples: string[] }
      competencyTwo?: { competency: string; examples: string[] }
      competencyThree?: { competency: string; examples: string[] }
      competencyFour?: { competency: string; examples: string[] }
      competencyFive?: { competency: string; examples: string[] }
    }
  }>>([])
  const [signingId, setSigningId] = useState<string | null>(null)
  const [signLoading, setSignLoading] = useState(false)
  const [signError, setSignError] = useState('')
  const [copiedReport, setCopiedReport] = useState(false)
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null)

  // AI draft state — competency examples: key = `${compIdx}-${exIdx}`
  type CompAIState = { showPrompt: boolean; context: string; loading: boolean; error: string }
  const [compAI, setCompAI] = useState<Record<string, CompAIState>>({})
  // AI draft state — goal explanations: key = goal index string
  const [goalAI, setGoalAI] = useState<Record<string, { loading: boolean; error: string }>>({})
  // AI draft state — next year goals
  const [nextYearAI, setNextYearAI] = useState<{ loading: boolean; error: string }>({ loading: false, error: '' })

  function getCompAI(ci: number, ei: number): CompAIState {
    return compAI[`${ci}-${ei}`] ?? { showPrompt: false, context: '', loading: false, error: '' }
  }
  function setCompAIKey(ci: number, ei: number, update: Partial<CompAIState>) {
    setCompAI(prev => ({ ...prev, [`${ci}-${ei}`]: { ...getCompAI(ci, ei), ...update } }))
  }

  async function draftCompExample(ci: number, ei: number) {
    const state = getCompAI(ci, ei)
    if (!state.context.trim()) return
    const comp = review.competencies[ci]
    setCompAIKey(ci, ei, { loading: true, error: '' })
    try {
      const res = await fetch('/api/self-reviews/draft-example', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competency: comp.term, type: comp.type, context: state.context, exampleIndex: ei, employeeName: profileName || profile.email }),
      })
      const data = await res.json() as { example?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed')
      updateExample(ci, ei, data.example ?? '')
      setCompAIKey(ci, ei, { showPrompt: false, context: '', loading: false, error: '' })
    } catch (e) {
      setCompAIKey(ci, ei, { loading: false, error: String(e) })
    }
  }

  async function draftGoalExplanation(i: number) {
    const goal = review.goals_objectives[i]
    if (!goal.description.trim() || !goal.outcome) return
    setGoalAI(prev => ({ ...prev, [i]: { loading: true, error: '' } }))
    try {
      const res = await fetch('/api/self-reviews/draft-goal-explanation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalDescription: goal.description, outcome: goal.outcome, employeeName: profileName || profile.email }),
      })
      const data = await res.json() as { explanation?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed')
      updateGoal(i, 'reasoning', data.explanation ?? '')
      setGoalAI(prev => ({ ...prev, [i]: { loading: false, error: '' } }))
    } catch (e) {
      setGoalAI(prev => ({ ...prev, [i]: { loading: false, error: String(e) } }))
    }
  }

  async function draftNextYearGoals() {
    setNextYearAI({ loading: true, error: '' })
    try {
      const res = await fetch('/api/self-reviews/draft-next-goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: profileName || profile.email,
          competencies: review.competencies.map(c => ({ competency: c.term, type: c.type, examples: c.examples })),
          currentGoals: review.goals_objectives.filter(g => g.description.trim()).map(g => ({ description: g.description, outcome: g.outcome, reasoning: g.reasoning })),
          overallRating: review.overall_rating,
        }),
      })
      const data = await res.json() as { goals?: Array<{ goal: string; objective: string }>; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed')
      const drafted = data.goals ?? []
      setReview(r => {
        const merged: NextYearGoal[] = drafted.map(d => ({ goal: d.goal, objective: d.objective }))
        while (merged.length < 2) merged.push({ goal: '', objective: '' })
        return { ...r, next_year_goals: merged }
      })
      setNextYearAI({ loading: false, error: '' })
    } catch (e) {
      setNextYearAI({ loading: false, error: String(e) })
    }
  }

  const isSubmitted = review.status === 'submitted'
  const saWindowOpen = activeCycle?.phase === 'sa_open'
  const saLocked = !isSubmitted && !saWindowOpen

  // Derive effective review stage from actual data rather than just activeCycle.phase
  const managerReviewComplete = managerReviews.length > 0
  const bothSigned = managerReviews.some(r => r.employee_signed_at)
  const effectivePhase = bothSigned ? 'complete' : managerReviewComplete ? 'meeting' : activeCycle?.phase ?? 'sa_open'


  // Check-in submissions shown as events on the Review Timeline. The Quarterly
  // Check-ins page itself is retired; this read-only summary is all that remains.
  const CI_YEAR = 2026
  const [allCheckins, setAllCheckins] = useState<Array<{ quarter: number; employee_submitted_at: string | null; manager_submitted_at: string | null }>>([])

  useEffect(() => {
    if (page !== 'timeline') return
    fetch(`/api/quarterly-checkins?employee_id=${profile.id}&year=${CI_YEAR}`)
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: Array<{ quarter: number; employee_submitted_at: string | null; manager_submitted_at: string | null }> } | null) => {
        setAllCheckins(json?.data ?? [])
      })
      .catch(() => {})
  }, [page])

  // DB notifications state
  const [cycleNotifs, setCycleNotifs] = useState<{ id: string; type: string; title: string; body: string; created_at: string }[]>([])
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => { if (d.notifications) setCycleNotifs(d.notifications) })
      .catch(() => {})
  }, [])

  async function markAllNotifsRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setCycleNotifs(ns => ns.map(n => ({ ...n, read_at: new Date().toISOString() })))
  }

  const totalUnread = unreadCount + cycleNotifs.filter(n => !(n as {read_at?: string}).read_at).length

  // Auto-save debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (isSubmitted || saLocked) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraft(), 1800)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review])

  function goStep(s: number) { setStep(Math.max(0, Math.min(s, SA_STEPS.length - 1))) }

  async function saveDraft() {
    setSaving(true)
    try {
      await fetch('/api/self-reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencies: review.competencies, goalsObjectives: review.goals_objectives,
          nextYearGoals: review.next_year_goals, overallRating: review.overall_rating,
          status: 'draft', strengths: '', growthAreas: '', goalReflections: [], overallComments: '',
        }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  async function submitReview() {
    setSaving(true)
    try {
      await fetch('/api/self-reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencies: review.competencies, goalsObjectives: review.goals_objectives,
          nextYearGoals: review.next_year_goals, overallRating: review.overall_rating,
          status: 'submitted', strengths: '', growthAreas: '', goalReflections: [], overallComments: '',
        }),
      })
      setReview(r => ({ ...r, status: 'submitted', submitted_at: new Date().toISOString() }))
      setSubmitConfirm(false); router.refresh()

      // Notify admin if overall rating is 2 stars or below
      if (review.overall_rating && review.overall_rating <= 2 && (selfReviewId ?? review.id)) {
        fetch('/api/reviews/low-score-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceId: selfReviewId ?? review.id,
            employeeName: profileName || profile.email,
            score: review.overall_rating,
            type: 'self_assessment',
          }),
        }).catch(() => { /* non-critical */ })
      }
    } finally { setSaving(false) }
  }

  async function sendToDrive() {
    setExporting(true); setExportError(null)
    try {
      const today = new Date()
      const yr = today.getFullYear()
      const res = await fetch('/api/self-reviews/send-to-drive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfReviewId: selfReviewId ?? review.id,
          employeeName: profileName || profile.email,
          employeePosition: position || '', supervisorName: manager?.name || manager?.email || '',
          appraisalPeriod: `${yr - 1} - ${yr}`,
          dateCompleted: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          competencies: review.competencies.map(c => ({ ...c, examples: c.examples as string[], definition: COMPETENCY_TERMS.find(t => t.term === c.term)?.definition ?? '' })),
          goalsObjectives: review.goals_objectives, overallRating: review.overall_rating, nextYearGoals: review.next_year_goals,
        }),
      })
      const data = await res.json() as { docUrl?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Export failed')
      setDriveUrl(data.docUrl ?? null)
    } catch (e) { setExportError(String(e)) }
    finally { setExporting(false) }
  }

  async function saveProfile() {
    if (!profileName.trim()) return
    setProfileSaving(true)
    try {
      await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profileName }) })
      setProfileSaved(true); setTimeout(() => { setProfileSaved(false); setShowProfileEdit(false) }, 1200)
      router.refresh()
    } finally { setProfileSaving(false) }
  }

  // Fetch goals when Goals page opens
  useEffect(() => {
    if (page !== 'goals') return
    setGoalsLoading(true)
    fetch('/api/goals').then(r => r.json()).then(d => { if (d.goals) setGoals(d.goals) }).finally(() => setGoalsLoading(false))
  }, [page])

  useEffect(() => {
    fetch('/api/reviews/upcoming-meeting')
      .then(r => r.ok ? r.json() : null)
      .then((d: { meeting: { id: string; meeting_scheduled_at: string; meeting_location: string | null } | null } | null) => {
        setUpcomingMeeting(d?.meeting ?? null)
      })
      .catch(() => {})
  }, [])

  // Fetch manager reviews when Reviews page opens
  useEffect(() => {
    if (page !== 'reviews') return
    fetch('/api/reviews')
      .then(r => r.json())
      .then(data => { if (data.reviews) setManagerReviews(data.reviews) })
      .catch(() => {})
  }, [page])

  async function handleEmployeeSign(reviewId: string, result: SignatureResult) {
    setSignLoading(true)
    setSignError('')
    try {
      const encoded = encodeSignature(result)
      const res = await fetch('/api/reviews/employee-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, employeeSignature: encoded }),
      })
      const data = await res.json() as { ok?: boolean; signedAt?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setManagerReviews(prev => prev.map(r => r.id === reviewId ? { ...r, employee_signed_at: data.signedAt ?? new Date().toISOString(), employee_signature: encoded } : r))
      setSigningId(null)
    } catch (e) {
      setSignError(String(e))
    } finally {
      setSignLoading(false)
    }
  }

  async function createGoal() {
    if (!goalForm.title.trim()) return
    setGoalSaving(true)
    try {
      const res = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalForm) })
      const d = await res.json() as { goal?: Goal }
      if (d.goal) setGoals(g => [d.goal!, ...g])
      setShowAddGoal(false)
      setGoalForm({ title: '', description: '', status: 'not_started', target_date: '', notes: '' })
    } finally { setGoalSaving(false) }
  }

  async function updateGoalRecord(id: string, updates: Partial<Goal>) {
    await fetch('/api/goals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
    setGoals(g => g.map(goal => goal.id === id ? { ...goal, ...updates } : goal))
  }

  async function deleteGoal(id: string) {
    await fetch('/api/goals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setGoals(g => g.filter(goal => goal.id !== id))
  }

  async function saveEditGoal() {
    if (!editingGoal) return
    setGoalSaving(true)
    try {
      await updateGoalRecord(editingGoal.id, goalForm)
      setEditingGoal(null)
    } finally { setGoalSaving(false) }
  }

  function krProgress(kr: KeyResult): number {
    if (kr.type === 'boolean') return kr.current >= 1 ? 100 : 0
    if (!kr.target || kr.target === 0) return 0
    return Math.min(100, Math.round((kr.current / kr.target) * 100))
  }

  function goalKrProgress(g: Goal): number {
    const krs = g.key_results ?? []
    if (!krs.length) return -1
    return Math.round(krs.reduce((sum, kr) => sum + krProgress(kr), 0) / krs.length)
  }

  async function addKeyResult(goalId: string) {
    if (!krForm.title.trim()) return
    setKrSaving(true)
    try {
      const goal = goals.find(g => g.id === goalId)
      if (!goal) return
      const newKr: KeyResult = {
        id: crypto.randomUUID(),
        title: krForm.title.trim(),
        type: krForm.type,
        current: parseFloat(krForm.current) || 0,
        target: krForm.type === 'boolean' ? 1 : parseFloat(krForm.target) || 100,
        unit: krForm.unit.trim() || undefined,
      }
      const updated = [...(goal.key_results ?? []), newKr]
      await updateGoalRecord(goalId, { key_results: updated } as unknown as Partial<Goal>)
      setKrAddingId(null)
      setKrForm({ title: '', type: 'percent', current: '', target: '', unit: '' })
    } finally { setKrSaving(false) }
  }

  async function updateKeyResultValue(goalId: string, krId: string, current: number) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const updated = (goal.key_results ?? []).map(kr => kr.id === krId ? { ...kr, current } : kr)
    await updateGoalRecord(goalId, { key_results: updated } as unknown as Partial<Goal>)
  }

  async function deleteKeyResult(goalId: string, krId: string) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const updated = (goal.key_results ?? []).filter(kr => kr.id !== krId)
    await updateGoalRecord(goalId, { key_results: updated } as unknown as Partial<Goal>)
  }

  // Computed notifications
  const notifications: { id: string; label: string; detail: string; color: string; action?: () => void }[] = []
  if (!isSubmitted) notifications.push({ id: 'draft', label: 'Self-assessment pending', detail: 'Your self-assessment is in draft. Submit it so your manager can review it.', color: 'var(--warning)', action: () => setPage('self-assessment') })
  if (isSubmitted && !driveUrl) notifications.push({ id: 'drive', label: 'Export ready', detail: 'Your submitted self-assessment can be exported to Google Drive.', color: 'var(--brand-text)', action: () => { setPage('self-assessment'); setStep(8) } })
  if (goals.some(g => g.target_date && g.status !== 'complete' && new Date(g.target_date) < new Date())) notifications.push({ id: 'overdue', label: 'Overdue goals', detail: 'You have goals past their target date that are not yet complete.', color: 'var(--danger)', action: () => setPage('goals') })

  function updateComp(i: number, field: string, value: unknown) {
    setReview(r => { const c = [...r.competencies]; c[i] = { ...c[i], [field]: value }; return { ...r, competencies: c } })
  }
  function updateExample(ci: number, ei: number, val: string) {
    setReview(r => {
      const c = [...r.competencies]; const ex = [...c[ci].examples] as [string, string, string]; ex[ei] = val
      c[ci] = { ...c[ci], examples: ex }; return { ...r, competencies: c }
    })
  }
  function updateGoal(i: number, f: string, v: string) {
    setReview(r => { const g = [...r.goals_objectives]; g[i] = { ...g[i], [f]: v }; return { ...r, goals_objectives: g } })
  }
  function updateNext(i: number, f: string, v: string) {
    setReview(r => { const g = [...r.next_year_goals]; g[i] = { ...g[i], [f]: v }; return { ...r, next_year_goals: g } })
  }

  // ── Shared tokens ─────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { width: '100%', background: 'var(--surface-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 12 }

  const navBtn = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: collapsed ? '8px' : '7px 10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: 'var(--radius-md)', border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent',
    background: active ? 'var(--brand-tint)' : 'transparent',
    cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s',
    fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--brand-text)' : 'var(--text-secondary)',
  })

  // ── Step tabs for Self Assessment ─────────────────────────────────────────
  function renderStepTabs() {
    return (
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px', background: 'var(--surface-inset)', overflowX: 'auto', flexShrink: 0, gap: 0 }}>
        {SA_STEPS.map((s, i) => {
          const done = isStepComplete(i, review, driveUrl)
          const active = step === i
          return (
            <button key={s.id} onClick={() => goStep(i)} style={{
              padding: '10px 14px', fontSize: 12, fontWeight: active ? 700 : 400,
              color: active ? 'var(--brand-text)' : done ? 'var(--success)' : 'var(--text-muted)',
              borderBottom: `2px solid ${active ? 'var(--brand)' : 'transparent'}`,
              background: 'transparent', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, transition: 'color 0.15s',
            } as React.CSSProperties}>
              {done && !active && <CheckCircle2 size={11} color="var(--success)" />}
              <span>{s.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Self Assessment step content ──────────────────────────────────────────
  function renderSAStep() {
    if (step === 0) return (
      <div>
        {/* Manager card */}
        <div style={{ ...card, borderLeft: '3px solid var(--brand-strong)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(manager?.name || manager?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Your Manager</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{manager?.name || manager?.email || 'Not assigned'}</div>
            {manager?.name && manager?.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{manager.email}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Status</div>
            <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 700, background: isSubmitted ? 'var(--success-bg)' : 'var(--warning-bg)', color: isSubmitted ? 'var(--success)' : 'var(--warning)', border: `1px solid ${isSubmitted ? 'var(--success-border)' : 'var(--warning-text)'}` }}>
              {isSubmitted ? '✓ Submitted' : 'Draft'}
            </span>
          </div>
        </div>
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {([['Your Name', profileName || profile.email], ['Position', position || '—'], ['Email', profile.email]] as [string, string][]).map(([l, v]) => (
              <div key={l}><div style={lbl}>{l}</div><div style={{ fontSize: 14, color: 'var(--text)' }}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{ ...card, background: 'var(--surface-inset)', border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>What to expect:</strong> You&apos;ll evaluate five competency words (two positive, two constructive, one of your choice), reflect on your goals and accomplishments, rate your overall performance, and set goals for the coming year.
            Use the <button onClick={() => setPage('guide')} style={{ color: 'var(--brand-text)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Employee Guide</button> and <button onClick={() => setPage('glossary')} style={{ color: 'var(--brand-text)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Competency Glossary</button> in the sidebar for reference.
          </p>
        </div>
      </div>
    )

    if (step >= 1 && step <= 5) {
      const ci = step - 1; const cfg = COMP_CONFIG[ci]; const comp = review.competencies[ci]
      const def = COMPETENCY_TERMS.find(t => t.term === comp?.term)
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 700, background: cfg.accent + '20', color: cfg.accent, border: `1px solid ${cfg.accent}40` }}>{cfg.sublabel}</span>
              {/* Type pills — Competency 5 only */}
              {ci === 4 && (['positive', 'constructive'] as const).map(t => {
                const isSelected = comp?.type === t
                const color = t === 'positive' ? 'var(--success)' : 'var(--warning)'
                return (
                  <button key={t} onClick={() => !isSubmitted && updateComp(ci, 'type', t)} disabled={isSubmitted}
                    style={{ padding: '3px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 700, border: `1px solid ${isSelected ? color : 'var(--border)'}`, background: isSelected ? color + '20' : 'transparent', color: isSelected ? color : 'var(--text-faint)', cursor: isSubmitted ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                    {t === 'positive' ? 'Positive' : 'Constructive'}
                  </button>
                )
              })}
              {ci !== 4 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select a competency and provide 1–3 specific examples.</span>}
            </div>
            <button onClick={() => setPage('glossary')} style={{ fontSize: 11, color: 'var(--brand-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', flexShrink: 0 }}>Browse Glossary →</button>
          </div>
          {/* Resolve accent for C5 based on selected type */}
          {(() => {
            const resolvedAccent = ci === 4
              ? (comp?.type === 'constructive' ? 'var(--warning)' : comp?.type === 'positive' ? 'var(--success)' : 'var(--brand)')
              : cfg.accent
            return (
          <div style={{ ...card, borderLeft: `3px solid ${resolvedAccent}` }}>
            <div style={lbl}>Competency Term</div>
            <select value={comp?.term || ''} onChange={e => updateComp(ci, 'term', e.target.value)} disabled={isSubmitted} style={{ ...inp, appearance: 'none' }}>
              <option value="">— Select from glossary —</option>
              {COMPETENCY_TERMS.map(t => <option key={t.term} value={t.term}>{t.term}</option>)}
            </select>
            {def && <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}><strong style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>Definition: </strong>{def.definition}</div>}
          </div>
            )
          })()}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={lbl}>Examples (1–3 specific situations)</div>
              {!isSubmitted && <span style={{ fontSize: 11, color: 'var(--brand-text)' }}>Use ✨ AI Draft on any example for help</span>}
            </div>
            {[0, 1, 2].map(ei => {
              const aiState = getCompAI(ci, ei)
              const canDraft = !!(comp?.term)
              return (
                <div key={ei} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 9, background: comp?.examples[ei]?.trim() ? cfg.accent : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: comp?.examples[ei]?.trim() ? '#fff' : 'var(--text-faint)', transition: 'background 0.2s' }}>{ei + 1}</div>
                    <div style={{ flex: 1 }}>
                      <textarea value={comp?.examples[ei] || ''} onChange={e => updateExample(ci, ei, e.target.value)} disabled={isSubmitted} placeholder={ei === 0 ? 'Required — describe a specific situation, your actions, and the result' : 'Optional — add another example'} rows={2} style={{ ...inp, resize: 'vertical' }} />
                      {!isSubmitted && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          {aiState.error && <span style={{ fontSize: 10, color: 'var(--danger)' }}>{aiState.error}</span>}
                          <button
                            onClick={() => setCompAIKey(ci, ei, { showPrompt: !aiState.showPrompt, error: '' })}
                            disabled={!canDraft}
                            title={!canDraft ? 'Select a competency first' : undefined}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: canDraft ? 'pointer' : 'not-allowed', color: aiState.showPrompt ? 'var(--brand-text)' : 'var(--brand-text)', fontSize: 11, fontWeight: 600, padding: 0, opacity: canDraft ? 1 : 0.3 }}>
                            <Sparkles size={11} />
                            {aiState.showPrompt ? 'Cancel' : 'AI Draft'}
                          </button>
                        </div>
                      )}
                      {!isSubmitted && aiState.showPrompt && (
                        <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 'var(--radius-lg)' }}>
                          <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--brand-text)' }}>Describe what happened — AI will write the example.</p>
                          <textarea
                            value={aiState.context}
                            onChange={e => setCompAIKey(ci, ei, { context: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) draftCompExample(ci, ei) }}
                            placeholder={ei === 0 ? 'e.g. "handled the Q3 client escalation, stayed calm, resolved it in 2 days"' : 'e.g. "still working on replying faster to Slack messages"'}
                            rows={2}
                            style={{ ...inp, fontSize: 12, resize: 'vertical', marginBottom: 8, border: '1px solid rgba(129,140,248,0.3)', background: 'var(--page)' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              onClick={() => draftCompExample(ci, ei)}
                              disabled={aiState.loading || !aiState.context.trim()}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(126,105,228,0.8)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 11, fontWeight: 600, cursor: aiState.loading || !aiState.context.trim() ? 'not-allowed' : 'pointer', opacity: aiState.loading || !aiState.context.trim() ? 0.5 : 1 }}>
                              {aiState.loading ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Sparkles size={11} /> Draft Example {ei + 1}</>}
                            </button>
                            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>⌘↵ to submit</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (step === 6) return (
      <div>
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>Goals, Objectives & Accomplishments</div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>Indicate completion of your goals or objectives and explain why. Include stand-alone accomplishments too.</p>
          {review.goals_objectives.map((g, i) => (
            <div key={i} style={{ padding: '14px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-lg)', marginBottom: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--success)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{i + 1}. Goal / Objective / Accomplishment</div>
              <div style={{ marginBottom: 10 }}><div style={lbl}>Description</div><textarea value={g.description} onChange={e => updateGoal(i, 'description', e.target.value)} disabled={isSubmitted} rows={2} placeholder="Describe your goal, objective, or accomplishment…" style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div><div style={lbl}>Outcome</div><select value={g.outcome} onChange={e => updateGoal(i, 'outcome', e.target.value)} disabled={isSubmitted} style={{ ...inp, appearance: 'none' }}><option value="">— Select —</option><option value="successful">✓ Successful</option><option value="unsuccessful">✗ Unsuccessful</option><option value="ongoing">↻ Ongoing</option></select></div>
                <div>
                  <div style={lbl}>Reason / Explanation</div>
                  <input value={g.reasoning} onChange={e => updateGoal(i, 'reasoning', e.target.value)} disabled={isSubmitted} placeholder="Why successful, unsuccessful, or still in progress?" style={inp} />
                  {!isSubmitted && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      {goalAI[i]?.error && <span style={{ fontSize: 10, color: 'var(--danger)' }}>{goalAI[i].error}</span>}
                      <button
                        onClick={() => draftGoalExplanation(i)}
                        disabled={!g.description.trim() || !g.outcome || !!goalAI[i]?.loading}
                        title={!g.description.trim() || !g.outcome ? 'Fill in description and outcome first' : undefined}
                        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: (!g.description.trim() || !g.outcome) ? 'not-allowed' : 'pointer', color: 'var(--brand-text)', fontSize: 11, fontWeight: 600, padding: 0, opacity: (!g.description.trim() || !g.outcome) ? 0.3 : 1 }}>
                        {goalAI[i]?.loading ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Sparkles size={11} /> AI Draft</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isSubmitted && review.goals_objectives.length < 5 && (
            <button onClick={() => setReview(r => ({ ...r, goals_objectives: [...r.goals_objectives, { description: '', outcome: '', reasoning: '' }] }))} style={{ width: '100%', padding: '8px', background: 'transparent', color: 'var(--success)', border: '1px dashed var(--success-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={13} /> Add Goal / Accomplishment</button>
          )}
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Overall Performance Rating</div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>Select the rating that best reflects your overall performance this review period.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[5, 4, 3, 2, 1].map(n => {
              const s = STAR_LABELS[n]; const sel = review.overall_rating === n
              return (
                <button key={n} onClick={() => !isSubmitted && setReview(r => ({ ...r, overall_rating: n }))} disabled={isSubmitted}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 'var(--radius-lg)', border: `1.5px solid ${sel ? s.color : 'var(--border)'}`, background: sel ? s.color + '15' : 'var(--surface-inset)', cursor: isSubmitted ? 'default' : 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 16, color: s.color, fontWeight: 800, minWidth: 80, letterSpacing: -1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</div>
                  <div><div style={{ fontWeight: 700, color: sel ? s.color : 'var(--text-secondary)', fontSize: 13 }}>{n} — {s.label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.description}</div></div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )

    if (step === 7) {
      const hasConstructive = review.competencies.some(c => c.type === 'constructive' && c.term)
      return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, flex: 1 }}>Identify at least two goals for the next review period with a roadmap for how you plan to reach each one. These will be discussed with your manager.</p>
          {!isSubmitted && (
            <div style={{ flexShrink: 0 }}>
              <button
                onClick={draftNextYearGoals}
                disabled={nextYearAI.loading || !hasConstructive}
                title={!hasConstructive ? 'Fill in your constructive competencies (steps 3–4) first' : 'Generate SMART goals based on your constructive competency areas'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: hasConstructive ? 'rgba(126,105,228,0.8)' : 'var(--border)', color: hasConstructive ? '#fff' : 'var(--text-faint)', border: `1px solid ${hasConstructive ? 'rgba(129,140,248,0.4)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, cursor: (nextYearAI.loading || !hasConstructive) ? 'not-allowed' : 'pointer' }}>
                {nextYearAI.loading ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : <><Sparkles size={12} /> AI Draft Goals</>}
              </button>
              {!hasConstructive && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4, textAlign: 'right' }}>Fill constructive competencies first</div>}
            </div>
          )}
        </div>
        {nextYearAI.error && <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{nextYearAI.error}</div>}
        {review.next_year_goals.map((g, i) => (
          <div key={i} style={{ ...card, borderLeft: '3px solid var(--warning)' }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--warning)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goal {i + 1}</div>
            <div style={{ marginBottom: 10 }}><div style={lbl}>Goal</div><input value={g.goal} onChange={e => updateNext(i, 'goal', e.target.value)} disabled={isSubmitted} placeholder="e.g. Improve public speaking skills" style={inp} /></div>
            <div><div style={lbl}>Objective / Roadmap</div><textarea value={g.objective} onChange={e => updateNext(i, 'objective', e.target.value)} disabled={isSubmitted} rows={2} placeholder="e.g. Attend a public speaking course and practice presentations quarterly" style={{ ...inp, resize: 'vertical' }} /></div>
          </div>
        ))}
        {!isSubmitted && review.next_year_goals.length < 5 && (
          <button onClick={() => setReview(r => ({ ...r, next_year_goals: [...r.next_year_goals, { goal: '', objective: '' }] }))} style={{ width: '100%', padding: '8px', background: 'transparent', color: 'var(--warning)', border: '1px dashed var(--warning-text)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={13} /> Add Another Goal</button>
        )}
      </div>
    )
    }

    if (step === 8) return (
      <div>
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>Assessment Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><div style={lbl}>Employee</div><div style={{ fontSize: 13, color: 'var(--text)' }}>{profileName || profile.email}</div></div>
            <div><div style={lbl}>Supervisor</div><div style={{ fontSize: 13, color: 'var(--text)' }}>{manager?.name || manager?.email || '—'}</div></div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Part One — Competencies</div>
          {review.competencies.map((c, i) => c.term ? (
            <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginBottom: 6, borderLeft: `3px solid ${COMP_CONFIG[i].accent}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{COMP_CONFIG[i].label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({COMP_CONFIG[i].sublabel})</span> — {c.term}</div>
              {c.examples.filter(Boolean).map((ex, j) => <div key={j} style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{j + 1}. {ex}</div>)}
            </div>
          ) : <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginBottom: 6, fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>{COMP_CONFIG[i].label} — not filled</div>)}
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Part Two — Goals & Rating</div>
          {review.goals_objectives.filter(g => g.description).map((g, i) => (
            <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{i + 1}. {g.description}</div>
              {g.outcome && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Outcome: {g.outcome}</div>}
            </div>
          ))}
          {review.overall_rating ? (
            <div style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginBottom: 6 }}>
              <span style={{ color: STAR_LABELS[review.overall_rating].color }}>{'★'.repeat(review.overall_rating)}</span>
              {' '}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{review.overall_rating}/5 — {STAR_LABELS[review.overall_rating].label}</span>
            </div>
          ) : <div style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No rating selected</div>}
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Part Three — Next Year&apos;s Goals</div>
          {review.next_year_goals.filter(g => g.goal).map((g, i) => (
            <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{i + 1}. {g.goal}</div>
              {g.objective && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{g.objective}</div>}
            </div>
          ))}
        </div>

        {!isSubmitted ? (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>Ready to submit?</div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Once submitted, your self-assessment is shared with your manager and cannot be edited. You&apos;ll then be able to export it to Google Drive.</p>
            <button onClick={() => setSubmitConfirm(true)} style={{ width: '100%', padding: '11px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Submit Self-Assessment</button>
          </div>
        ) : driveUrl ? (
          <div style={{ ...card, background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 20 }}>✅</div>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>Saved to Google Drive</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', padding: '7px 12px', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driveUrl}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--success-border)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 12, textDecoration: 'none', border: '1px solid var(--success)' }}><ExternalLink size={12} /> Open in Google Docs</a>
              <button onClick={sendToDrive} disabled={exporting} style={{ padding: '8px 14px', background: 'transparent', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 12, border: '1px solid var(--border)', cursor: 'pointer' }}>Re-export</button>
              <button onClick={() => { setShowManualLink(true); setManualLinkValue(driveUrl ?? '') }} style={{ padding: '8px 14px', background: 'transparent', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 12, border: '1px solid var(--border)', cursor: 'pointer' }}>Replace link</button>
            </div>
            {showManualLink && (
              <div style={{ marginTop: 12, padding: '12px', background: 'var(--surface-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Paste a Google Docs or Drive URL:</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={manualLinkValue} onChange={e => { setManualLinkValue(e.target.value); setManualLinkError('') }} onKeyDown={e => { if (e.key === 'Enter') saveManualDriveLink() }} placeholder="https://docs.google.com/document/d/..." style={{ ...inp, flex: 1, fontSize: 12 }} />
                  <button onClick={saveManualDriveLink} disabled={manualLinkSaving || !manualLinkValue.trim()} style={{ padding: '8px 14px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{manualLinkSaving ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => { setShowManualLink(false); setManualLinkError('') }} style={{ padding: '8px 12px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
                </div>
                {manualLinkError && <div style={{ fontSize: 11, color: 'var(--danger)' }}>{manualLinkError}</div>}
              </div>
            )}
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>Export to Google Drive</div>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>A formatted Google Doc will be created in the Performance Reviews folder.</p>
            {!approved ? (
              <button onClick={() => setApproved(true)} style={{ width: '100%', padding: '10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Confirm accuracy and approve for export</button>
            ) : (
              <div>
                <div style={{ padding: '8px 12px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: 12, marginBottom: 12 }}>✓ Approved — ready to export</div>
                {exportError && <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{exportError}</div>}
                <button onClick={sendToDrive} disabled={exporting} style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, var(--success), var(--success))', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {exporting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating Google Doc…</> : <><Send size={14} /> Send to Google Drive</>}
                </button>
              </div>
            )}
            {/* Manual link entry */}
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {!showManualLink ? (
                <button onClick={() => setShowManualLink(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Already have a doc? Paste the link manually
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Paste a Google Docs or Drive URL:</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input value={manualLinkValue} onChange={e => { setManualLinkValue(e.target.value); setManualLinkError('') }} onKeyDown={e => { if (e.key === 'Enter') saveManualDriveLink() }} placeholder="https://docs.google.com/document/d/..." style={{ ...inp, flex: 1, fontSize: 12 }} />
                    <button onClick={saveManualDriveLink} disabled={manualLinkSaving || !manualLinkValue.trim()} style={{ padding: '8px 14px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: (!manualLinkValue.trim() || manualLinkSaving) ? 0.6 : 1 }}>{manualLinkSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => { setShowManualLink(false); setManualLinkError('') }} style={{ padding: '8px 12px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
                  </div>
                  {manualLinkError && <div style={{ fontSize: 11, color: 'var(--danger)' }}>{manualLinkError}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
    return null
  }

  // ── Markdown renderer (strips ## and ** for display) ─────────────────────
  function renderComparisonReport(text: string) {
    const renderInline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={pi} style={{ color: 'var(--text)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        : <span key={pi}>{part}</span>
    )
    const sections = text.split(/\n(?=## )/)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sections.map((section, idx) => {
          const lines = section.trim().split('\n')
          const rawHeading = lines[0]
          const isHeading = rawHeading.startsWith('## ')
          const heading = isHeading ? rawHeading.replace(/^##\s*/, '') : ''
          const bodyLines = isHeading ? lines.slice(1) : lines
          const hc =
            heading.includes('AGREE') || heading.includes('ALIGN') ? 'var(--success)' :
            heading.includes('DIFFER')                              ? 'var(--warning)' :
            heading.includes('TALKING')                             ? 'var(--info)' :
            heading.includes('ACTION') || heading.includes('PLAN')  ? 'var(--brand-soft)' :
            heading.includes('GOAL')                                ? 'var(--brand)' : 'var(--text)'
          const bc =
            heading.includes('AGREE') || heading.includes('ALIGN') ? 'rgba(52,211,153,0.15)' :
            heading.includes('DIFFER')                              ? 'rgba(251,191,36,0.15)' :
            heading.includes('TALKING')                             ? 'rgba(96,165,250,0.15)'  :
            heading.includes('ACTION') || heading.includes('PLAN')  ? 'rgba(167,139,250,0.15)' :
            heading.includes('GOAL')                                ? 'rgba(34,211,238,0.15)'  : 'rgba(30,32,48,0.5)'
          const total = sections.length
          return (
            <div key={idx} style={{ padding: '16px 20px', borderTop: idx === 0 ? 'none' : '1px solid var(--surface-hover)', background: idx % 2 === 0 ? 'var(--surface-inset)' : 'var(--page)', borderRadius: idx === 0 ? '10px 10px 0 0' : idx === total - 1 ? '0 0 10px 10px' : '0' }}>
              {heading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 'var(--radius-sm)', background: hc, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: hc, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }}>{heading}</span>
                  <div style={{ flex: 1, height: 1, background: bc }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bodyLines.map((line, li) => {
                  const trimmed = line.trim()
                  if (!trimmed) return <div key={li} style={{ height: 4 }} />
                  if (/^[-*]\s/.test(trimmed)) return (
                    <div key={li} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--brand-text)', flexShrink: 0, marginTop: 1 }}>•</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{renderInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
                    </div>
                  )
                  if (/^\d+\.\s/.test(trimmed)) {
                    const num = trimmed.match(/^(\d+)\./)?.[1] ?? ''
                    const rest = trimmed.replace(/^\d+\.\s+/, '')
                    return (
                      <div key={li} style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--brand-text)', flexShrink: 0, minWidth: 16, textAlign: 'right' as const, fontSize: 13 }}>{num}.</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{renderInline(rest)}</span>
                      </div>
                    )
                  }
                  return <p key={li} style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{renderInline(trimmed)}</p>
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Page: Performance Reviews ─────────────────────────────────────────────
  function renderReviewsPage() {
    const sLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }

    // ── No manager review yet ────────────────────────────────────────────────
    if (managerReviews.length === 0) {
      return (
        <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Performance Review Meeting</h1>
          <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--text-muted)' }}>Side-by-side view of your self-assessment and manager review, available once your manager completes their review.</p>
          {!isSubmitted && (
            <div style={{ ...card, background: 'var(--surface-inset)', borderLeft: '3px solid var(--warning)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>Complete your Self-Assessment first</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Your self-assessment must be submitted before your manager can write your performance review.</div>
              <button onClick={() => setPage('self-assessment')} style={{ padding: '7px 16px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Go to Self-Assessment</button>
            </div>
          )}
          <div style={{ ...card, background: 'var(--surface-inset)', textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>No performance reviews yet</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, maxWidth: 400, marginInline: 'auto' }}>Once your manager completes and submits your performance review, this panel will show a side-by-side comparison of your self-assessment and their review.</p>
          </div>
        </div>
      )
    }

    // ── Meeting view ────────────────────────────────────────────────────────
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px 64px' }}>
        {managerReviews.map(r => {
          const form = r.form_data as Record<string, unknown> | null
          const score = (form?.overallScore as number | undefined) ?? r.overall_score ?? 0
          const saCompetencies = review.competencies.filter(c => c.term)

          return (
            <div key={r.id}>
              {/* Header — matches ReviewSignPage */}
              <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Performance Review</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>{profileName || profile.email}</div>
                  {r.employee_position && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{r.employee_position}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {driveUrl && <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}><ExternalLink size={12} /> SA Doc</a>}
                  {r.drive_url && <a href={r.drive_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}><ExternalLink size={12} /> Review Doc</a>}
                  {r.employee_signed_at ? (
                    <div style={{ padding: '6px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>✓ Fully Signed</div>
                  ) : (
                    <div style={{ padding: '6px 14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-text)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, color: 'var(--warning)' }}>Awaiting Your Signature</div>
                  )}
                </div>
              </div>

              {/* Side-by-side panels */}
              {form && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

                  {/* Left: Self-Assessment */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 16px', background: 'var(--brand-tint)', border: '1px solid var(--brand-tint)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self-Assessment</div>
                      {review.submitted_at && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Submitted {new Date(review.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                    </div>
                    <div style={{ padding: 16, background: 'var(--surface-inset)', border: '1px solid var(--brand-tint)', borderRadius: '0 0 10px 10px', flex: 1 }}>
                      {!isSubmitted ? (
                        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>No self-assessment on file.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Competencies */}
                          {saCompetencies.length > 0 && (
                            <div>
                              <div style={sLabel}>Competencies</div>
                              {saCompetencies.map((c, i) => {
                                const col = c.type === 'positive' ? 'var(--success)' : c.type === 'constructive' ? 'var(--warning)' : 'var(--brand)'
                                return (
                                  <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${col}30`, borderLeft: `3px solid ${col}`, borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{c.term}</div>
                                    {c.examples.filter(e => e.trim()).map((ex, ei) => (
                                      <div key={ei} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>{ex}</div>
                                    ))}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {/* Goals */}
                          {review.goals_objectives.filter(g => g.description?.trim()).length > 0 && (
                            <div>
                              <div style={sLabel}>Goals &amp; Objectives</div>
                              {review.goals_objectives.filter(g => g.description?.trim()).map((g, i) => (
                                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                                  <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{g.description}</div>
                                  {g.outcome && <span style={{ fontSize: 11, fontWeight: 600, color: g.outcome === 'successful' ? 'var(--success)' : g.outcome === 'ongoing' ? 'var(--warning)' : 'var(--danger)', textTransform: 'capitalize' }}>{g.outcome}</span>}
                                  {g.reasoning && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{g.reasoning}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Self-rating */}
                          {review.overall_rating != null && (
                            <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Self Rating</span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-text)' }}>{'★'.repeat(review.overall_rating)}{'☆'.repeat(5 - review.overall_rating)}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{STAR_LABELS[review.overall_rating]?.label}</span>
                            </div>
                          )}
                          {/* Next year goals */}
                          {review.next_year_goals.filter(g => g.goal?.trim()).length > 0 && (
                            <div>
                              <div style={sLabel}>Next Year&apos;s Goals</div>
                              {review.next_year_goals.filter(g => g.goal?.trim()).map((g, i) => (
                                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{g.goal}</div>
                                  {g.objective && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.objective}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Manager Review — matches ReviewSignPage blue panel */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 16px', background: 'var(--surface-inset)', border: '1px solid var(--info-border)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance Review</div>
                      {form.reviewDate ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Review Date: {String(form.reviewDate)}</div> : <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Signed {new Date(r.manager_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                    </div>
                    <div style={{ padding: 16, background: 'var(--surface-inset)', border: '1px solid var(--info-border)', borderRadius: '0 0 10px 10px', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Employee info */}
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{r.employee_name || profileName || profile.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.employee_position}{form.appraisalPeriod ? ` · ${String(form.appraisalPeriod)}` : ''}</div>
                          {!!form.supervisorName && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Supervisor: {String(form.supervisorName)}</div>}
                        </div>
                        {/* Competencies */}
                        {([
                          { entry: form.competencyOne as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                          { entry: form.competencyTwo as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                          { entry: form.competencyThree as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                          { entry: form.competencyFour as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                          { entry: form.competencyFive as { competency?: string; examples?: string[] } | undefined, type: (form.competencyFiveType as string) || 'positive' },
                        ].filter(c => c.entry?.competency).length > 0) && (
                          <div>
                            <div style={sLabel}>Competencies</div>
                            {[
                              { entry: form.competencyOne as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                              { entry: form.competencyTwo as { competency?: string; examples?: string[] } | undefined, type: 'positive' },
                              { entry: form.competencyThree as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                              { entry: form.competencyFour as { competency?: string; examples?: string[] } | undefined, type: 'constructive' },
                              { entry: form.competencyFive as { competency?: string; examples?: string[] } | undefined, type: (form.competencyFiveType as string) || 'positive' },
                            ].filter(c => c.entry?.competency).map((c, i) => {
                              const col = c.type === 'positive' ? 'var(--success)' : 'var(--warning)'
                              return (
                                <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${col}30`, borderLeft: `3px solid ${col}`, borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{c.entry!.competency}</div>
                                  {(c.entry!.examples ?? []).filter(e => e.trim()).map((ex, ei) => (
                                    <div key={ei} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>{ei + 1}. {ex}</div>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {/* Goals */}
                        {(form.goals as Array<{ text: string; status?: string; explanation?: string }> | undefined)?.filter(g => g.text?.trim()).length ? (
                          <div>
                            <div style={sLabel}>Goals &amp; Objectives</div>
                            {(form.goals as Array<{ text: string; status?: string; explanation?: string }>).filter(g => g.text?.trim()).map((g, i) => (
                              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                                <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: g.status ? 4 : 0 }}>{g.text}</div>
                                {g.status && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-lg)', background: g.status === 'Successful' ? 'var(--success-bg)' : g.status === 'Unsuccessful' ? 'var(--danger-bg)' : 'var(--warning-bg)', color: g.status === 'Successful' ? 'var(--success)' : g.status === 'Unsuccessful' ? 'var(--danger)' : 'var(--warning)' }}>{g.status}</span>}
                                {g.explanation && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{g.explanation}</div>}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {/* Overall score */}
                        {score > 0 && (
                          <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Overall Score</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--info)' }}>{'★'.repeat(score)}{'☆'.repeat(5 - score)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{STAR_LABELS[score]?.label}</span>
                          </div>
                        )}
                        {/* Overall summary */}
                        {(form.overallSummary as string | undefined) && (
                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Summary</div>
                            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{String(form.overallSummary)}</div>
                          </div>
                        )}
                        {/* Next year goals */}
                        {(form.nextGoals as Array<{ text: string; targetDate?: string }> | undefined)?.filter(g => g.text?.trim()).length ? (
                          <div>
                            <div style={sLabel}>Next Year&apos;s Goals</div>
                            {(form.nextGoals as Array<{ text: string; targetDate?: string }>).filter(g => g.text?.trim()).map((g, i) => (
                              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{g.text}</div>
                                {g.targetDate && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: {g.targetDate}</div>}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Comparison Report ── */}
              {r.comparison_report && (
                <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(88,28,235,0.06)', padding: 20, marginBottom: 24 }}>
                  {/* Top header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        📄 Comparison Report
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                        AI-generated report comparing the self-assessment and performance review — alignment areas, divergence, talking points, and action plan.
                      </div>
                    </div>
                  </div>
                  {/* COMPARISON REPORT sub-header with Edit/Copy */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-text)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Comparison Report</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(r.comparison_report!)
                          setCopiedReport(true)
                          setTimeout(() => setCopiedReport(false), 2000)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-inset)', color: copiedReport ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        {copiedReport ? '✓ Copied!' : '⎘ Copy'}
                      </button>
                    </div>
                  </div>
                  {/* Report body */}
                  <div style={{ background: 'var(--page)', border: '1px solid var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
                    {renderComparisonReport(r.comparison_report)}
                  </div>
                </div>
              )}

              {/* ── Signatures ── */}
              <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 20 }}>Signatures</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: !r.employee_signed_at ? 20 : 0 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manager</div>
                    <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                      <SignatureDisplay stored={r.manager_signature} date={r.manager_signed_at} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Employee</div>
                    {r.employee_signed_at ? (
                      <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                        <SignatureDisplay stored={r.employee_signature} date={r.employee_signed_at} />
                      </div>
                    ) : (
                      <div style={{ padding: '14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-text)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>Awaiting Your Signature</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sign below to acknowledge this review has been discussed.</div>
                      </div>
                    )}
                  </div>
                </div>
                {!r.employee_signed_at && (
                  signingId === r.id ? (
                    <div style={{ background: 'var(--page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        By signing, you acknowledge that you have reviewed this performance evaluation and discussed it with your manager.
                      </p>
                      <SignaturePad
                        onSign={result => handleEmployeeSign(r.id, result)}
                        loading={signLoading}
                        error={signError}
                        buttonLabel="✍️ Sign & Acknowledge"
                        onCancel={() => { setSigningId(null); setSignError('') }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSigningId(r.id); setSignError('') }}
                      style={{ width: '100%', padding: '12px 20px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✍️ Sign &amp; Acknowledge Review
                    </button>
                  )
                )}
                {r.employee_signed_at && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} color="var(--success)" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>Review acknowledged and signed on {new Date(r.employee_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Page: Goals Tracker ───────────────────────────────────────────────────
  const STATUS_CONFIG = {
    not_started: { label: 'Not Started', color: 'var(--text-muted)', bg: 'var(--surface)' },
    in_progress:  { label: 'In Progress', color: 'var(--warning)', bg: 'var(--warning-bg)' },
    complete:     { label: 'Complete',    color: 'var(--success)', bg: 'var(--success-bg)' },
  }

  function renderGoalsPage() {
    const complete   = goals.filter(g => g.status === 'complete').length
    const inProgress = goals.filter(g => g.status === 'in_progress').length
    const overdue    = goals.filter(g => g.target_date && g.status !== 'complete' && new Date(g.target_date) < new Date()).length

    const formFields = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><div style={lbl}>Goal Title *</div><input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Improve public speaking skills" style={inp} autoFocus /></div>
        <div><div style={lbl}>Description</div><textarea value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="What does success look like?" rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div style={lbl}>Status</div>
            <select value={goalForm.status} onChange={e => setGoalForm(f => ({ ...f, status: e.target.value as Goal['status'] }))} style={{ ...inp, appearance: 'none' }}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div><div style={lbl}>Target Date</div><input type="date" value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} style={inp} /></div>
        </div>
        <div><div style={lbl}>Notes / Progress Update</div><textarea value={goalForm.notes} onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} placeholder="Add any notes or progress updates…" rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
      </div>
    )

    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Goals Tracker</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Track your progress between review cycles. Click &apos;Import Goals into SA&apos; to pre-fill your Next Year&apos;s Goals.</p>
          </div>
          <button onClick={() => { setShowAddGoal(true); setGoalForm({ title: '', description: '', status: 'not_started', target_date: '', notes: '' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={14} /> Add Goal
          </button>
        </div>

        {/* Stats */}
        {goals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total', value: goals.length, color: 'var(--text-secondary)' },
              { label: 'In Progress', value: inProgress, color: 'var(--warning)' },
              { label: 'Complete', value: complete, color: 'var(--success)' },
              { label: 'Overdue', value: overdue, color: overdue > 0 ? 'var(--danger)' : 'var(--text-faint)' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Import Goals into SA callout */}
        {!isSubmitted && goals.filter(g => g.status !== 'complete').length > 0 && (
          <div style={{ ...card, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(79,70,229,0.06)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 3 }}>Pre-fill Next Year&apos;s Goals in your Self-Assessment</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Import your active goals as a starting point for the Next Year&apos;s Goals section.</div>
              {goalsImportMsg && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{goalsImportMsg}</div>}
            </div>
            <button
              onClick={() => {
                const active = goals.filter(g => g.status !== 'complete')
                setReview(r => ({ ...r, next_year_goals: active.map(g => ({ goal: g.title, objective: g.description || '' })) }))
                setGoalsImportMsg(`Imported ${active.length} goal${active.length !== 1 ? 's' : ''} — redirecting…`)
                setTimeout(() => {
                  setGoalsImportMsg(null)
                  setPage('self-assessment')
                  setStep(7)
                }, 1200)
              }}
              style={{ flexShrink: 0, padding: '8px 18px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Import Goals into SA →
            </button>
          </div>
        )}

        {/* Add goal form */}
        {showAddGoal && (
          <div style={{ ...card, border: '1px solid rgba(79,70,229,0.4)', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>New Goal</div>
            {formFields}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowAddGoal(false)} style={{ flex: 1, padding: '9px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={createGoal} disabled={goalSaving || !goalForm.title.trim()} style={{ flex: 2, padding: '9px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!goalForm.title.trim() || goalSaving) ? 0.6 : 1 }}>
                {goalSaving ? 'Saving…' : 'Add Goal'}
              </button>
            </div>
          </div>
        )}

        {/* Goals list */}
        {goalsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} /><br />Loading goals…</div>
        ) : goals.length === 0 ? (
          <div style={{ ...card, background: 'var(--surface-inset)', textAlign: 'center', padding: '40px' }}>
            <EmptyState
              icon={<Target size={20} />}
              title="Turn expectations into measurable progress."
              description="Create goals to keep priorities clear throughout the review period."
              action={<CButton onClick={() => setShowAddGoal(true)}>Create Goal</CButton>}
            />
          </div>
        ) : (
          goals.map(g => {
            const sc = STATUS_CONFIG[g.status]
            const isEditing = editingGoal?.id === g.id
            const isOverdue = g.target_date && g.status !== 'complete' && new Date(g.target_date) < new Date()
            return (
              <div key={g.id} style={{ ...card, borderLeft: `3px solid ${sc.color}`, background: isEditing ? 'var(--brand-tint)' : 'var(--surface)' }}>
                {isEditing ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--brand-text)', marginBottom: 14 }}>Editing Goal</div>
                    {formFields}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button onClick={() => setEditingGoal(null)} style={{ flex: 1, padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      <button onClick={saveEditGoal} disabled={goalSaving} style={{ flex: 2, padding: '8px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{goalSaving ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{g.title}</div>
                        {g.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{g.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {g.status !== 'complete' && (
                          <button onClick={() => updateGoalRecord(g.id, { status: g.status === 'not_started' ? 'in_progress' : 'complete' })}
                            title={g.status === 'not_started' ? 'Mark In Progress' : 'Mark Complete'}
                            style={{ padding: '4px 8px', background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer' }}>
                            {g.status === 'not_started' ? '▶ Start' : '✓ Done'}
                          </button>
                        )}
                        <button onClick={() => { setEditingGoal(g); setGoalForm({ title: g.title, description: g.description, status: g.status, target_date: g.target_date, notes: g.notes }) }}
                          style={{ padding: '4px 8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteGoal(g.id)} style={{ padding: '4px 8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>

                    {/* Overall KR progress bar */}
                    {(() => {
                      const pct = goalKrProgress(g)
                      if (pct < 0) return null
                      const barColor = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--brand)' : 'var(--warning)'
                      return (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Results Progress</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: barColor }}>{pct}%</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 'var(--radius-sm)', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      )
                    })()}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>{sc.label}</span>
                      {g.target_date && (
                        <span style={{ fontSize: 11, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {isOverdue ? '⚠ Overdue · ' : '📅 '}{new Date(g.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      <button onClick={() => setKrExpandedIds(s => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}
                        style={{ marginLeft: 'auto', padding: '2px 8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer' }}>
                        🎯 Key Results {(g.key_results ?? []).length > 0 ? `(${g.key_results.length})` : ''} {krExpandedIds.has(g.id) ? '▲' : '▼'}
                      </button>
                    </div>

                    {g.notes && <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{g.notes}</div>}

                    {/* Key Results expanded section */}
                    {krExpandedIds.has(g.id) && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        {(g.key_results ?? []).length === 0 && krAddingId !== g.id && (
                          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>No key results yet. Add measurable targets to track progress.</div>
                        )}

                        {/* KR rows */}
                        {(g.key_results ?? []).map(kr => {
                          const pct = krProgress(kr)
                          const barColor = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--brand)' : 'var(--warning)'
                          const displayValue = kr.type === 'boolean'
                            ? (kr.current >= 1 ? 'Complete' : 'Incomplete')
                            : kr.type === 'currency'
                              ? `$${kr.current.toLocaleString()} / $${kr.target.toLocaleString()}${kr.unit ? ' ' + kr.unit : ''}`
                              : kr.type === 'percent'
                                ? `${kr.current}% / ${kr.target}%`
                                : `${kr.current}${kr.unit ? ' ' + kr.unit : ''} / ${kr.target}${kr.unit ? ' ' + kr.unit : ''}`
                          return (
                            <div key={kr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 10px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{kr.title}</span>
                                  <span style={{ fontSize: 11, color: barColor, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 8 }}>{displayValue}</span>
                                </div>
                                <div style={{ height: 4, background: 'var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 'var(--radius-sm)', transition: 'width 0.3s ease' }} />
                                </div>
                              </div>
                              {/* Inline current value editor */}
                              {kr.type !== 'boolean' ? (
                                <input
                                  type="number"
                                  defaultValue={kr.current}
                                  onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== kr.current) updateKeyResultValue(g.id, kr.id, v) }}
                                  style={{ width: 64, padding: '3px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text)', textAlign: 'right' }}
                                />
                              ) : (
                                <button onClick={() => updateKeyResultValue(g.id, kr.id, kr.current >= 1 ? 0 : 1)}
                                  style={{ padding: '3px 8px', background: kr.current >= 1 ? 'var(--success-bg)' : 'var(--border)', color: kr.current >= 1 ? 'var(--success)' : 'var(--text-muted)', border: `1px solid ${kr.current >= 1 ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  {kr.current >= 1 ? '✓ Done' : 'Mark Done'}
                                </button>
                              )}
                              <button onClick={() => deleteKeyResult(g.id, kr.id)}
                                style={{ padding: '3px 6px', background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                            </div>
                          )
                        })}

                        {/* Add KR form */}
                        {krAddingId === g.id ? (
                          <div style={{ padding: '12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', marginTop: 4 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <input value={krForm.title} onChange={e => setKrForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Key result title, e.g. Increase quarterly revenue" autoFocus
                                style={{ padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text)' }} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <select value={krForm.type} onChange={e => setKrForm(f => ({ ...f, type: e.target.value as KeyResult['type'] }))}
                                  style={{ padding: '7px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text)', appearance: 'none' }}>
                                  <option value="percent">% Percent</option>
                                  <option value="number">🔢 Number</option>
                                  <option value="currency">$ Currency</option>
                                  <option value="boolean">✓ Complete/Incomplete</option>
                                </select>
                                {krForm.type !== 'boolean' && <>
                                  <input type="number" value={krForm.current} onChange={e => setKrForm(f => ({ ...f, current: e.target.value }))}
                                    placeholder="Current" style={{ padding: '7px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text)' }} />
                                  <input type="number" value={krForm.target} onChange={e => setKrForm(f => ({ ...f, target: e.target.value }))}
                                    placeholder="Target" style={{ padding: '7px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text)' }} />
                                </>}
                              </div>
                              {(krForm.type === 'number') && (
                                <input value={krForm.unit} onChange={e => setKrForm(f => ({ ...f, unit: e.target.value }))}
                                  placeholder="Unit label (optional), e.g. clients, calls, posts"
                                  style={{ padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text)' }} />
                              )}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { setKrAddingId(null); setKrForm({ title: '', type: 'percent', current: '', target: '', unit: '' }) }}
                                  style={{ flex: 1, padding: '7px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                                <button onClick={() => addKeyResult(g.id)} disabled={krSaving || !krForm.title.trim()}
                                  style={{ flex: 2, padding: '7px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (!krForm.title.trim() || krSaving) ? 0.6 : 1 }}>
                                  {krSaving ? 'Saving…' : 'Add Key Result'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setKrAddingId(g.id); setKrForm({ title: '', type: 'percent', current: '', target: '', unit: '' }) }}
                            style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'transparent', color: 'var(--brand-text)', border: '1px dashed var(--brand-strong)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}>
                            <Plus size={12} /> Add Key Result
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    )
  }

  // ── Page: Review Timeline ──────────────────────────────────────────────────
  function renderTimelinePage() {
    const events: { icon: string; label: string; time: string; color: string; sortKey: string }[] = []
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (review.submitted_at) events.push({ icon: '✅', label: 'Self-assessment submitted', time: fmtDate(review.submitted_at), color: 'var(--success)', sortKey: review.submitted_at })
    if (driveUrl) events.push({ icon: '📤', label: 'Exported to Google Drive', time: 'Recent', color: 'var(--brand-text)', sortKey: '9999' })
    if (review.status === 'draft') events.push({ icon: '💾', label: 'Draft in progress', time: 'Auto-saved', color: 'var(--warning)', sortKey: '0000' })

    // Quarterly check-in events
    for (const qn of [1, 2, 3]) {
      const ci = allCheckins.find(c => c.quarter === qn)
      if (ci?.employee_submitted_at) {
        events.push({ icon: '📋', label: `Q${qn} Check-in Submitted`, time: fmtDate(ci.employee_submitted_at), color: 'var(--success)', sortKey: ci.employee_submitted_at })
      } else {
        events.push({ icon: '🔘', label: `Q${qn} Check-in`, time: 'Pending', color: 'var(--text-faint)', sortKey: `pending-q${qn}` })
      }
      if (ci?.manager_submitted_at) {
        events.push({ icon: '👤', label: `Q${qn} Manager Check-in`, time: fmtDate(ci.manager_submitted_at), color: 'var(--brand-text)', sortKey: ci.manager_submitted_at })
      }
    }

    // Sort: real timestamps first (ISO strings sort lexicographically), pending/special last
    events.sort((a, b) => {
      const aReal = /^\d{4}-\d{2}-\d{2}/.test(a.sortKey)
      const bReal = /^\d{4}-\d{2}-\d{2}/.test(b.sortKey)
      if (aReal && bReal) return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0
      if (aReal) return -1
      if (bReal) return 1
      return a.sortKey < b.sortKey ? -1 : 1
    })

    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Review Timeline</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--text-muted)' }}>A chronological log of your review activity and milestones.</p>
        {events.length === 0 ? (
          <div style={{ ...card, background: 'var(--surface-inset)', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🕐</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No activity recorded yet</div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 19, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${e.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, zIndex: 1 }}>{e.icon}</div>
                <div style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{e.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Page: Quarterly Check-ins ─────────────────────────────────────────────

  // ── Page: Employee Guide ──────────────────────────────────────────────────
  function renderGuidePage() {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Employee Guide to Self-Assessments</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)' }}>Reference this guide when completing your self-assessment.</p>

        <p style={{ ...card as object, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'block' } as React.CSSProperties}>
          This self-assessment provides you an opportunity to reflect on your performance during the review period, set goals, and identify areas for development. It will also help prepare you for the evaluation discussion with your supervisor.
        </p>

        {[
          { title: 'Preparation', accent: 'var(--brand)', content: 'Prepare your self-assessment by reviewing your job description and past evaluations, and gathering relevant documentation to give a reason for your evaluation of your performance.' },
          { title: 'Components of a Self-Assessment', accent: 'var(--brand)', content: 'The self-assessment components include a 5-Word Competency assessment, goal/objective successful or unsuccessful completion, and accomplishments. Make sure you indicate any challenges you faced and any training or development needs.' },
          { title: 'Tips', accent: 'var(--brand)', content: 'As you reflect on your performance, make sure you are honest with yourself, use specific examples, stay professional, and reflect on any periodic feedback you have received from management throughout the year.' },
          { title: 'Mistakes to Avoid', accent: 'var(--danger)', content: '• Avoid generalized or vague statements — be specific about accomplishments and areas for growth.\n• Don\'t shy away from discussing difficulties; they are part of your growth journey.\n• Don\'t ignore input from others — take feedback, positive and constructive, to heart.' },
        ].map(s => (
          <div key={s.title} style={{ ...card, borderLeft: `3px solid ${s.accent}` }}>
            <div style={{ fontWeight: 700, color: s.accent, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}

        <div style={card}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 14, marginBottom: 14 }}>Rush Media Star Rating Matrix</div>
          {[5, 4, 3, 2, 1].map(n => {
            const s = STAR_LABELS[n]
            return (
              <div key={n} style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 16, color: s.color, fontWeight: 800, minWidth: 24 }}>{n}</div>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{s.description}</div></div>
              </div>
            )
          })}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 14, marginBottom: 14 }}>SMART Goal Method</div>
          {[['S', 'Specific', 'Goals should be specific and narrow enough for effective planning and attainability.'], ['M', 'Measurable', 'Define how progress towards the goal will be made.'], ['A', 'Attainable', 'Ensure goals are accomplished reasonably within a certain timeframe.'], ['R', 'Relevant', 'Goals should align with Company values and your job description.'], ['T', 'Time-Bound', 'Set a realistic date and stick to it.']].map(([l, w, d]) => (
            <div key={l} style={{ display: 'flex', gap: 14, marginBottom: 8, padding: '8px 12px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 800, color: 'var(--brand-text)', fontSize: 16, minWidth: 18 }}>{l}</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{w}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{d}</div></div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 14, marginBottom: 14 }}>Goals vs. Objectives vs. Accomplishments</div>
          {[
            { title: 'Goal', color: 'var(--brand-text)', desc: 'Broad, longer-term, achievable outcomes agreed upon by the employee and manager as a plan of action for the following review cycle.', example: 'Improve public speaking skills.' },
            { title: 'Objective', color: 'var(--success)', desc: 'Shorter, more specific, measurable steps toward achieving a goal. Generally determined by the employee with manager support.', example: 'Attend a public speaking course and practice presentations to a colleague one time per quarter.' },
            { title: 'Accomplishment', color: 'var(--warning)', desc: 'Tangible achievements or milestones from pursuing goals and objectives — what has been successfully met regardless of whether it was part of the goal-planning process.', example: 'Successfully delivered a presentation at a Company-wide meeting that received positive feedback from senior management.' },
          ].map(item => (
            <div key={item.title} style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>{item.desc}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Example: {item.example}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 14, marginBottom: 12 }}>Questions to Ask Yourself</div>
          {['How do you perform on the team and in comparison to your colleagues?', 'Does your performance limit the success of your colleagues or does it help them?', 'Are you transparent with yourself about your performance?', 'Are you efficient?', 'What is one small thing you would change that you feel would have the biggest impact to your performance?', 'How would you describe your work ethic in one word?', 'Where have you made the most progress?', 'What makes you most proud?', 'Where have you had the most impact on others and what word best describes that impact?'].map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--brand-text)', fontSize: 10, marginTop: 4, flexShrink: 0 }}>▸</span> {q}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Page: PIP / Coaching Plan ─────────────────────────────────────────────
  function renderPipPage() {
    return <EmployeePipPanel />
  }

  // ── Page: Glossary ────────────────────────────────────────────────────────
  function renderGlossaryPage() {
    const filtered = COMPETENCY_TERMS.filter(t =>
      t.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      t.definition.toLowerCase().includes(glossarySearch.toLowerCase())
    )
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Competency Glossary of Terms</h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>Use these definitions when selecting your competency words in Part One of the self-assessment.</p>
        <input value={glossarySearch} onChange={e => setGlossarySearch(e.target.value)} placeholder="Search by term or definition…" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{filtered.length} of {COMPETENCY_TERMS.length} terms</span>
        </div>
        {filtered.map(t => (
          <div key={t.term} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, color: 'var(--brand-text)', fontSize: 14, marginBottom: 5 }}>{t.term}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t.definition}</div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: 14 }}>No matching competencies found.</div>}
      </div>
    )
  }

  // ── Notification Bell ─────────────────────────────────────────────────────
  const CYCLE_NOTIF_COLORS: Record<string, string> = {
    sa_open: 'var(--brand)', sa_submitted: 'var(--success)', review_open: 'var(--warning)',
    review_exported: 'var(--success)', meeting: 'var(--info)', signed: 'var(--danger)', complete: 'var(--success)',
  }

  function NotificationBell() {
    const allNotifs = totalUnread > 0 || cycleNotifs.length > 0
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setShowNotifications(n => !n); if (!showNotifications) markAllNotifsRead() }}
          style={{ position: 'relative', width: 34, height: 34, borderRadius: 'var(--radius-md)', background: showNotifications ? 'var(--brand-tint)' : 'transparent', border: '1px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          onMouseLeave={e => { if (!showNotifications) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}>
          <Bell size={16} />
          {(totalUnread > 0 || notifications.length > 0) && (
            <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 14, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--warning)', border: '1.5px solid var(--surface-inset)', fontSize: 8, fontWeight: 700, color: 'var(--text-on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
              {totalUnread + notifications.length || ''}
            </span>
          )}
        </button>
        {showNotifications && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowNotifications(false)} />
            <div style={{ position: 'absolute', right: 0, top: 40, width: 340, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
                {allNotifs && <span style={{ fontSize: 10, fontWeight: 700, background: '#f59e0b20', color: 'var(--warning)', padding: '1px 6px', borderRadius: 'var(--radius-lg)' }}>{totalUnread + notifications.length}</span>}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* DB cycle notifications */}
                {cycleNotifs.map(n => (
                  <div key={n.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: CYCLE_NOTIF_COLORS[n.type] ?? 'var(--brand)', flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.body}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3 }}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                  </div>
                ))}
                {/* UI-computed notifications */}
                {notifications.map(n => (
                  <div key={n.id} onClick={() => { if (n.action) { n.action(); setShowNotifications(false) } }}
                    style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: n.action ? 'pointer' : 'default', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                    onMouseEnter={e => { if (n.action) e.currentTarget.style.background = 'var(--surface-inset)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.color, flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.detail}</div>
                      {n.action && <div style={{ fontSize: 10, color: n.color, marginTop: 3, fontWeight: 600 }}>View →</div>}
                    </div>
                  </div>
                ))}
                {!allNotifs && notifications.length === 0 && (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>🔔</div>
                    All caught up!
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const displayName = profileName || profile.email

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--page)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-strong)', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: collapsed ? 64 : 240, flexShrink: 0, background: 'var(--surface-inset)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden' }}>

        {/* Logo + collapse */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: collapsed ? '0 12px' : '0 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {!collapsed && <CalibrLogo height={24} />}
          {collapsed && <CalibrIcon size={24} />}
          <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 8px 6px', marginBottom: 2 }}>Menu</div>}
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            const Icon = item.icon
            return (
              <button key={item.id} onClick={() => setPage(item.id)} title={collapsed ? item.label : undefined}
                style={navBtn(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <Icon size={15} color={active ? 'var(--brand-text)' : 'var(--text-muted)'} />
                {!collapsed && item.label}
                {/* Draft indicator on self-assessment */}
                {item.id === 'self-assessment' && !collapsed && !isSubmitted && (
                  <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />
                )}
                {item.id === 'self-assessment' && !collapsed && isSubmitted && (
                  <CheckCircle2 size={11} color="var(--success)" style={{ marginLeft: 'auto' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: collapsed ? '8px' : '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {/* Auto-save status */}
          {!collapsed && page === 'self-assessment' && !isSubmitted && (
            <div style={{ padding: '5px 8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving…</span></> : saved ? <><CheckCircle2 size={10} color="var(--success)" /><span style={{ fontSize: 11, color: 'var(--success)' }}>Saved</span></> : <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Auto-saves</span>}
            </div>
          )}

          {/* Supervisor — always visible */}
          {!collapsed && (
            <div style={{ padding: '7px 8px', marginBottom: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Supervisor</div>
              {manager ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(manager.name || manager.email).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{manager.name || manager.email}</div>
                    {manager.name && <div style={{ fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{manager.email}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>Not assigned</div>
              )}
            </div>
          )}
          {collapsed && manager && (
            <div title={manager.name || manager.email} style={{ display: 'flex', justifyContent: 'center', padding: '6px 0', marginBottom: 2 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                {(manager.name || manager.email).charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Profile — clickable */}
          <button onClick={() => setShowProfileEdit(true)} title={collapsed ? displayName : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', borderRadius: 'var(--radius-md)', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>Employee · Edit profile</div>
              </div>
            )}
            {!collapsed && <Pencil size={11} color="var(--text-faint)" />}
          </button>

          {/* Theme */}
          <div style={{ padding: collapsed ? '0 12px 8px' : '0 12px 8px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <ThemeToggle compact={collapsed} />
          </div>

          {/* Middle managers reach this portal from their own manager portal — give them the way back */}
          {profile.role === 'middle_manager' && (
            <a
              href="/performance-review"
              title={collapsed ? 'Back to Manager Portal' : undefined}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 'var(--radius-md)', textDecoration: 'none', boxSizing: 'border-box' }}
            >
              <ArrowLeft size={14} color="var(--brand-text)" />
              {!collapsed && <span style={{ fontSize: 12, color: 'var(--brand-text)', fontWeight: 600 }}>Manager Portal</span>}
            </a>
          )}

          {/* Sign out */}
          <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }} title={collapsed ? 'Sign out' : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', borderRadius: 'var(--radius-md)', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', marginTop: 2 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; (e.currentTarget.querySelector('span') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('span') as HTMLElement).style.color = 'var(--danger)') }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; (e.currentTarget.querySelector('span') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('span') as HTMLElement).style.color = 'var(--text-muted)') }}>
            <LogOut size={14} color="var(--text-muted)" />
            {!collapsed && <span style={{ fontSize: 12, color: 'var(--text-muted)', transition: 'color 0.15s' }}>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Self Assessment: step tabs + progress */}
        {page === 'self-assessment' && (
          <>
            {/* Manager strip */}
            <div style={{ height: 40, background: 'var(--surface-inset)', borderBottom: '1px solid var(--border)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-strong)' }}>Self Assessment</span>
                {saLocked && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '1px 8px' }}>🔒 Closed</span>}
                {saWindowOpen && <span style={{ fontSize: 10, color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-pill)', padding: '1px 8px' }}>● Open</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Supervisor:</span>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                  {(manager?.name || manager?.email || '?').charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{manager?.name || manager?.email || 'Not assigned'}</span>
                <NotificationBell />
              </div>
            </div>
            {!saLocked && renderStepTabs()}
            {!saLocked && (
              <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--brand-strong), var(--brand-strong))', width: `${(step / (SA_STEPS.length - 1)) * 100}%`, transition: 'width 0.3s ease' }} />
              </div>
            )}
          </>
        )}

        {/* Other pages: header bar with notification bell */}
        {page !== 'self-assessment' && (
          <div style={{ height: 56, background: 'var(--surface-inset)', borderBottom: '1px solid var(--border)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{NAV_ITEMS.find(n => n.id === page)?.label}</span>
            <NotificationBell />
          </div>
        )}


        {/* Upcoming review meeting — the employee's only signal that one is booked */}
        {upcomingMeeting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px', background: 'var(--brand-tint)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: 15 }}>🗓️</span>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              Your performance review meeting is scheduled for{' '}
              <strong style={{ color: 'var(--brand-text)' }}>
                {new Date(upcomingMeeting.meeting_scheduled_at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
              </strong>
              {upcomingMeeting.meeting_location ? ` · ${upcomingMeeting.meeting_location}` : ''}
            </span>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {page === 'self-assessment' && saLocked && (
            <div style={{ padding: '48px 32px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 8 }}>Self-Assessment is Closed</div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
                Your self-assessment will become editable when your annual review cycle opens — approximately 30 days before your work anniversary.
              </p>
              {activeCycle && effectivePhase !== 'sa_open' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', textAlign: 'left', maxWidth: 420, margin: '0 auto 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Your {activeCycle.anniversary_year} Review Cycle</div>
                  {[
                    { label: 'Self-Assessment', open: activeCycle.sa_open_at, close: activeCycle.sa_close_at, phase: 'sa_open', isDone: isSubmitted },
                    { label: 'Manager Review', open: activeCycle.review_open_at, close: activeCycle.review_close_at, phase: 'review_open', isDone: managerReviewComplete },
                    { label: '1-on-1 Meeting', open: activeCycle.meeting_open_at, close: activeCycle.meeting_close_at, phase: 'meeting', isDone: bothSigned },
                    { label: 'Signatures', open: activeCycle.meeting_open_at, close: activeCycle.meeting_close_at, phase: 'complete', isDone: bothSigned },
                  ].map(w => {
                    const isCurrent = effectivePhase === w.phase
                    return (
                      <div key={w.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isCurrent && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 4px var(--success)', flexShrink: 0 }} />}
                          {w.isDone && !isCurrent && <span style={{ fontSize: 10, color: 'var(--success)', flexShrink: 0 }}>✓</span>}
                          <span style={{ fontSize: 12, color: isCurrent ? 'var(--text-strong)' : w.isDone ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: isCurrent ? 600 : 400 }}>{w.label}</span>
                        </div>
                        <span style={{ fontSize: 11, color: w.phase === 'meeting' && upcomingMeeting ? 'var(--brand-text)' : 'var(--text-faint)' }}>
                          {w.phase === 'meeting' && upcomingMeeting
                            ? new Date(upcomingMeeting.meeting_scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : w.phase !== 'complete' ? `${new Date(w.open).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(w.close).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : (bothSigned ? 'Complete' : 'Pending')}
                        </span>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Work Anniversary</span>
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                      {new Date(activeCycle.trigger_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )}
              {!activeCycle && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', fontSize: 13, color: 'var(--text-faint)', maxWidth: 420, margin: '0 auto' }}>
                  No active review cycle found. Your manager or admin will be notified when your anniversary is approaching.
                </div>
              )}
            </div>
          )}

          {page === 'self-assessment' && !saLocked && (
            <div style={{ padding: '24px 32px', maxWidth: 720, margin: '0 auto' }}>
              {renderSAStep()}
            </div>
          )}
          {page === 'reviews'  && renderReviewsPage()}
          {page === 'timeline' && renderTimelinePage()}
          {page === 'goals'     && renderGoalsPage()}
          {page === 'pip'       && renderPipPage()}
          {page === 'guide'     && renderGuidePage()}
          {page === 'glossary'  && renderGlossaryPage()}
        </div>

        {/* Self Assessment bottom nav */}
        {page === 'self-assessment' && !saLocked && (
          <div style={{ height: 60, background: 'var(--surface-inset)', borderTop: '1px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={() => goStep(step - 1)} disabled={step === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'transparent', color: step > 0 ? 'var(--text-secondary)' : 'var(--text-faint)', border: `1px solid ${step > 0 ? 'var(--border)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: step > 0 ? 'pointer' : 'default' }}>
              <ChevronLeft size={14} /> Back
            </button>
            <div style={{ display: 'flex', gap: 5 }}>
              {SA_STEPS.map((_, i) => (
                <div key={i} onClick={() => goStep(i)} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 'var(--radius-sm)', background: i === step ? 'var(--brand)' : i < step ? 'var(--brand-strong)' : 'var(--border)', transition: 'all 0.2s', cursor: 'pointer' }} />
              ))}
            </div>
            {step < SA_STEPS.length - 1 ? (
              <button onClick={() => goStep(step + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Next <ChevronRight size={14} />
              </button>
            ) : <div style={{ width: 80 }} />}
          </div>
        )}
      </main>

      {/* ── Profile edit modal ── */}
      {showProfileEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setShowProfileEdit(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 28, width: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>Edit Profile</h2>
              <button onClick={() => setShowProfileEdit(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Display Name</div>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={lbl}>Email</div>
              <input value={profile.email} disabled style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Email is managed by your Google account and cannot be changed here.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowProfileEdit(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveProfile} disabled={profileSaving || !profileName.trim()} style={{ flex: 2, padding: '10px', background: profileSaved ? 'linear-gradient(135deg, var(--success), var(--success))' : 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (!profileName.trim() || profileSaving) ? 0.6 : 1 }}>
                {profileSaved ? <><Check size={14} /> Saved!</> : profileSaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit confirmation ── */}
      {submitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 28, maxWidth: 400, width: '90%' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, color: 'var(--text-strong)' }}>Submit Self-Assessment?</h2>
            <p style={{ margin: '0 0 22px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>Once submitted, your self-assessment will be shared with your manager and cannot be edited.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSubmitConfirm(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Go Back</button>
              <button onClick={submitReview} disabled={saving} style={{ flex: 2, padding: '10px', background: 'var(--brand-strong)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
