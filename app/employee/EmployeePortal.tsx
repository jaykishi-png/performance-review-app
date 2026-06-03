'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, FileText, BookOpen, BookMarked,
  Send, LogOut, CheckCircle2, Star, Plus, X, Loader2,
  ExternalLink, Clock, Bell, Target, User, ChevronDown,
  BarChart2, History, Pencil, Check, Sparkles,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Page = 'self-assessment' | 'reviews' | 'timeline' | 'goals' | 'guide' | 'glossary'

type Goal = {
  id: string
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'complete'
  target_date: string
  notes: string
  created_at: string
}
type CompetencyType = 'positive' | 'constructive' | 'choice'
type Competency = { type: CompetencyType; term: string; examples: [string, string, string] }
type GoalItem = { description: string; outcome: 'successful' | 'unsuccessful' | ''; reasoning: string }
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

type Profile = { id: string; name: string | null; email: string; role: string; manager_id: string | null }
type Manager = { name: string | null; email: string } | null

// ── Static data ───────────────────────────────────────────────────────────────

const COMPETENCY_TERMS: { term: string; definition: string }[] = [
  { term: 'Accountability and Dependability', definition: 'Takes personal responsibility for the quality and timeliness of work; achieves qualitative results with little oversight.' },
  { term: 'Adaptability and Flexibility', definition: 'Adapts to changing business needs, conditions, and work responsibilities; works with a variety of situations, individuals, groups, and varying types of needs in a productive manner.' },
  { term: 'Analysis/Reasoning', definition: 'Examines data to comprehend and grasp issues, draw conclusions, and solve problems.' },
  { term: 'Attention to Detail', definition: 'Diligently attends to details and pursues quality in accomplishing tasks.' },
  { term: 'Business Alignment', definition: 'Work performed and produced aligns with the direction, products, services, and performance of the business with the rest of the organizational objectives.' },
  { term: 'Coaching and Mentoring', definition: 'Enables colleagues to grow and succeed through feedback, instruction, and encouragement.' },
  { term: 'Communication', definition: 'Listens to others and communicates in an effective manner.' },
  { term: 'Confidence', definition: 'Matured and justified self-belief in one\'s ability to do the job in a successful and productive manner.' },
  { term: 'Creative and Innovative Thinking', definition: 'Develops fresh ideas that provide solutions to all types of workplace challenges.' },
  { term: 'Customer Focused', definition: 'Builds and maintains customer satisfaction with the products offered by the organization and provides excellent customer service to internal and external customers.' },
  { term: 'Decision Making and Judgement', definition: 'Makes timely, informed decisions that take into account the facts, goals, constraints, and risks.' },
  { term: 'Developing Others', definition: 'Willingness to delegate responsibility when applicable, work with others, and coach to develop others\' capabilities.' },
  { term: 'Development and Continuous Learning', definition: 'Displays an ongoing commitment to learning and self-improvement; has the desire and makes the effort to acquire new knowledge or skills for work.' },
  { term: 'Empowering Others', definition: 'Conveying confidence in employees\' ability to be successful and autonomous, especially with new and challenging tasks; allowing employees the freedom to decide how they will accomplish their goals and resolve issues.' },
  { term: 'Ethics and Integrity', definition: 'Earns others\' trust and respect through consistent honesty and professionalism in all interactions.' },
  { term: 'Flexibility', definition: 'Adapting to and working with a variety of situations, individuals, and groups. Openness to different and new ways of doing things; willingness to modify one\'s preferred way of doing things.' },
  { term: 'Group Facilitation', definition: 'Enables and encourages cooperative and productive group interactions.' },
  { term: 'Influencing Others', definition: 'Influences others to be excited and committed to furthering the organization objectives; ability to gain others\' support for ideas, proposals, and solutions.' },
  { term: 'Initiative', definition: 'Recognizes situations that warrant initiative and moves forward without hesitation; reasonably resolves issues, problems, or situations.' },
  { term: 'Interpersonal Skills', definition: 'Gets along and interacts positively with colleagues and others; understands and relates to others.' },
  { term: 'Leadership', definition: 'Promotes organizational mission and goals, and shows ways to achieve them.' },
  { term: 'Listening', definition: 'Comprehends, understands, and learns from what others say.' },
  { term: 'Planning and Organizing', definition: 'Defining tasks and milestones to achieve objectives while ensuring the optimal use of resources to achieve those objectives.' },
  { term: 'Policy, Rules, and Regulation Enforcement', definition: 'Enforces policies, rules, and regulations consistently and in a way that is and is perceived as fair, objective, and reasonable.' },
  { term: 'Problem-Solving', definition: 'Resolves difficult or complicated challenges.' },
  { term: 'Project Management', definition: 'Structures and directs others\' work on projects or programs; ensures timeliness of project completion and meets project objectives deadlines.' },
  { term: 'Reading Comprehension', definition: 'Grasps the meaning of written information and applies it to work situations.' },
  { term: 'Relationship Building', definition: 'Builds constructive working relationships characterized by a high level of acceptance, cooperation, and mutual respect.' },
  { term: 'Researching Information', definition: 'Identifies, collects, and organizes data for analyzing and decision-making.' },
  { term: 'Results Focused', definition: 'Focuses on results and desired outcomes and how best to achieve them in order to get the job done.' },
  { term: 'Risk Management', definition: 'Identifying, assessing, and managing risk while striving to attain objectives.' },
  { term: 'Speaking', definition: 'Conveys ideas and facts orally pertinent and relevant to the audience and in a way the audience can understand.' },
  { term: 'Staff Management', definition: 'Manages staff in ways that improve their ability to succeed on the job in an autonomous manner.' },
  { term: 'Strategic Vision', definition: 'Sees the big, long-range picture.' },
  { term: 'Stress Tolerance', definition: 'Maintains composure in highly stressful or adverse situations.' },
  { term: 'Tact', definition: 'Diplomatically handles challenges or tense interpersonal situations.' },
  { term: 'Teamwork', definition: 'Promotes cooperation and commitment within a team to achieve goals and deliverables.' },
  { term: 'Training and Presenting Information', definition: 'Formally, effectively, and thoughtfully delivers information to a group.' },
  { term: 'Writing', definition: 'Conveys ideas and facts in writing using language the reader and audience will best understand.' },
]

const STAR_LABELS: Record<number, { label: string; description: string; color: string }> = {
  5: { label: 'Outstanding',              description: 'Consistently exceeds performance requirements.',                               color: '#a78bfa' },
  4: { label: 'Exceeds Job Requirements', description: 'Meets and at times exceeds performance requirements (above average).',          color: '#34d399' },
  3: { label: 'Meets Expectations',       description: 'Job requirements are being met at a satisfactory level.',                      color: '#fbbf24' },
  2: { label: 'Needs Improvement',        description: 'Does not consistently meet the expected job requirements.',                    color: '#fb923c' },
  1: { label: 'Unsatisfactory',           description: 'Demonstrates an unacceptable level of skills and competencies.',               color: '#f87171' },
}

const COMP_CONFIG: { type: CompetencyType; label: string; sublabel: string; accent: string }[] = [
  { type: 'positive',     label: 'Competency 1', sublabel: 'Positive',     accent: '#10b981' },
  { type: 'positive',     label: 'Competency 2', sublabel: 'Positive',     accent: '#10b981' },
  { type: 'constructive', label: 'Competency 3', sublabel: 'Constructive', accent: '#f97316' },
  { type: 'constructive', label: 'Competency 4', sublabel: 'Constructive', accent: '#f97316' },
  { type: 'choice',       label: 'Competency 5', sublabel: 'Your Choice',  accent: '#818cf8' },
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
  { id: 'self-assessment', label: 'Self Assessment',      icon: FileText   },
  { id: 'reviews',         label: 'Performance Reviews',  icon: BarChart2  },
  { id: 'timeline',        label: 'Review Timeline',      icon: History    },
  { id: 'goals',           label: 'Goals Tracker',        icon: Target     },
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

function isStepComplete(stepIdx: number, r: SelfReview): boolean {
  switch (stepIdx) {
    case 0: return true
    case 1: case 2: case 3: case 4: case 5:
      return !!(r.competencies[stepIdx - 1]?.term && r.competencies[stepIdx - 1]?.examples[0]?.trim())
    case 6: return !!(r.goals_objectives.some(g => g.description.trim()) && r.overall_rating)
    case 7: return r.next_year_goals.some(g => g.goal.trim())
    default: return false
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  profile: Profile
  manager: Manager
  initialSelfReview: Partial<SelfReview> | null
  initialDriveUrl?: string | null
  selfReviewId?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeePortal({ profile, manager, initialSelfReview, initialDriveUrl, selfReviewId }: Props) {
  const router = useRouter()
  const [page, setPage] = useState<Page>('self-assessment')
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
  // Notifications
  const [showNotifications, setShowNotifications] = useState(false)

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

  // Auto-save debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (isSubmitted) return
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
          employeePosition: '', supervisorName: manager?.name || manager?.email || '',
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

  // Computed notifications
  const notifications: { id: string; label: string; detail: string; color: string; action?: () => void }[] = []
  if (!isSubmitted) notifications.push({ id: 'draft', label: 'Self-assessment pending', detail: 'Your self-assessment is in draft. Submit it so your manager can review it.', color: '#f59e0b', action: () => setPage('self-assessment') })
  if (isSubmitted && !driveUrl) notifications.push({ id: 'drive', label: 'Export ready', detail: 'Your submitted self-assessment can be exported to Google Drive.', color: '#818cf8', action: () => { setPage('self-assessment'); setStep(8) } })
  if (goals.some(g => g.target_date && g.status !== 'complete' && new Date(g.target_date) < new Date())) notifications.push({ id: 'overdue', label: 'Overdue goals', detail: 'You have goals past their target date that are not yet complete.', color: '#f87171', action: () => setPage('goals') })

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
  const inp: React.CSSProperties = { width: '100%', background: '#0d0f1a', border: '1px solid #2a2d3a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e5e7eb', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }
  const card: React.CSSProperties = { background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '18px 20px', marginBottom: 12 }

  const navBtn = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: collapsed ? '8px' : '7px 10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent',
    background: active ? '#1e1f3a' : 'transparent',
    cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s',
    fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#e0e7ff' : '#9ca3af',
  })

  // ── Step tabs for Self Assessment ─────────────────────────────────────────
  function renderStepTabs() {
    return (
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2130', padding: '0 28px', background: '#0d0f1a', overflowX: 'auto', flexShrink: 0, gap: 0 }}>
        {SA_STEPS.map((s, i) => {
          const done = isStepComplete(i, review)
          const active = step === i
          return (
            <button key={s.id} onClick={() => goStep(i)} style={{
              padding: '10px 14px', fontSize: 12, fontWeight: active ? 700 : 400,
              color: active ? '#818cf8' : done ? '#34d399' : '#6b7280',
              borderBottom: `2px solid ${active ? '#6366f1' : 'transparent'}`,
              background: 'transparent', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, transition: 'color 0.15s',
            } as React.CSSProperties}>
              {done && !active && <CheckCircle2 size={11} color="#34d399" />}
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
        <div style={{ ...card, borderLeft: '3px solid #4f46e5', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(manager?.name || manager?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Your Manager</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{manager?.name || manager?.email || 'Not assigned'}</div>
            {manager?.name && manager?.email && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{manager.email}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Status</div>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isSubmitted ? '#0d1a13' : '#1f1a0d', color: isSubmitted ? '#34d399' : '#f59e0b', border: `1px solid ${isSubmitted ? '#1a4a35' : '#92400e'}` }}>
              {isSubmitted ? '✓ Submitted' : 'Draft'}
            </span>
          </div>
        </div>
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['Your Name', profileName || profile.email], ['Email', profile.email]].map(([l, v]) => (
              <div key={l}><div style={lbl}>{l}</div><div style={{ fontSize: 14, color: '#e5e7eb' }}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{ ...card, background: '#0d1117', border: '1px solid #1e2130' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            <strong style={{ color: '#9ca3af' }}>What to expect:</strong> You&apos;ll evaluate five competency words (two positive, two constructive, one of your choice), reflect on your goals and accomplishments, rate your overall performance, and set goals for the coming year.
            Use the <button onClick={() => setPage('guide')} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Employee Guide</button> and <button onClick={() => setPage('glossary')} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Competency Glossary</button> in the sidebar for reference.
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.accent + '20', color: cfg.accent, border: `1px solid ${cfg.accent}40` }}>{cfg.sublabel}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Select a competency and provide 1–3 specific examples.</span>
            </div>
            <button onClick={() => setPage('glossary')} style={{ fontSize: 11, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', flexShrink: 0 }}>Browse Glossary →</button>
          </div>
          <div style={{ ...card, borderLeft: `3px solid ${cfg.accent}` }}>
            <div style={lbl}>Competency Term</div>
            <select value={comp?.term || ''} onChange={e => updateComp(ci, 'term', e.target.value)} disabled={isSubmitted} style={{ ...inp, appearance: 'none' }}>
              <option value="">— Select from glossary —</option>
              {COMPETENCY_TERMS.map(t => <option key={t.term} value={t.term}>{t.term}</option>)}
            </select>
            {def && <div style={{ marginTop: 10, padding: '10px 12px', background: '#0d1117', borderRadius: 8, fontSize: 12, color: '#9ca3af', lineHeight: 1.6, fontStyle: 'italic' }}><strong style={{ color: '#6b7280', fontStyle: 'normal' }}>Definition: </strong>{def.definition}</div>}
          </div>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={lbl}>Examples (1–3 specific situations)</div>
              {!isSubmitted && <span style={{ fontSize: 11, color: '#818cf8' }}>Use ✨ AI Draft on any example for help</span>}
            </div>
            {[0, 1, 2].map(ei => {
              const aiState = getCompAI(ci, ei)
              const canDraft = !!(comp?.term)
              return (
                <div key={ei} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 9, background: comp?.examples[ei]?.trim() ? cfg.accent : '#1e2130', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: comp?.examples[ei]?.trim() ? '#fff' : '#4b5563', transition: 'background 0.2s' }}>{ei + 1}</div>
                    <div style={{ flex: 1 }}>
                      <textarea value={comp?.examples[ei] || ''} onChange={e => updateExample(ci, ei, e.target.value)} disabled={isSubmitted} placeholder={ei === 0 ? 'Required — describe a specific situation, your actions, and the result' : 'Optional — add another example'} rows={2} style={{ ...inp, resize: 'vertical' }} />
                      {!isSubmitted && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          {aiState.error && <span style={{ fontSize: 10, color: '#f87171' }}>{aiState.error}</span>}
                          <button
                            onClick={() => setCompAIKey(ci, ei, { showPrompt: !aiState.showPrompt, error: '' })}
                            disabled={!canDraft}
                            title={!canDraft ? 'Select a competency first' : undefined}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: canDraft ? 'pointer' : 'not-allowed', color: aiState.showPrompt ? '#a78bfa' : '#818cf8', fontSize: 11, fontWeight: 600, padding: 0, opacity: canDraft ? 1 : 0.3 }}>
                            <Sparkles size={11} />
                            {aiState.showPrompt ? 'Cancel' : 'AI Draft'}
                          </button>
                        </div>
                      )}
                      {!isSubmitted && aiState.showPrompt && (
                        <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 10 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 11, color: '#a78bfa' }}>Describe what happened — AI will write the example.</p>
                          <textarea
                            value={aiState.context}
                            onChange={e => setCompAIKey(ci, ei, { context: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) draftCompExample(ci, ei) }}
                            placeholder={ei === 0 ? 'e.g. "handled the Q3 client escalation, stayed calm, resolved it in 2 days"' : 'e.g. "still working on replying faster to Slack messages"'}
                            rows={2}
                            style={{ ...inp, fontSize: 12, resize: 'vertical', marginBottom: 8, border: '1px solid rgba(129,140,248,0.3)', background: '#0a0c14' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              onClick={() => draftCompExample(ci, ei)}
                              disabled={aiState.loading || !aiState.context.trim()}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(126,105,228,0.8)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: aiState.loading || !aiState.context.trim() ? 'not-allowed' : 'pointer', opacity: aiState.loading || !aiState.context.trim() ? 0.5 : 1 }}>
                              {aiState.loading ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Sparkles size={11} /> Draft Example {ei + 1}</>}
                            </button>
                            <span style={{ fontSize: 10, color: '#4b5563' }}>⌘↵ to submit</span>
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
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 6 }}>Goals, Objectives & Accomplishments</div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>Indicate completion of your goals or objectives and explain why. Include stand-alone accomplishments too.</p>
          {review.goals_objectives.map((g, i) => (
            <div key={i} style={{ padding: '14px', background: '#0d1117', borderRadius: 10, marginBottom: 10, border: '1px solid #1e2130' }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: '#10b981', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{i + 1}. Goal / Objective / Accomplishment</div>
              <div style={{ marginBottom: 10 }}><div style={lbl}>Description</div><textarea value={g.description} onChange={e => updateGoal(i, 'description', e.target.value)} disabled={isSubmitted} rows={2} placeholder="Describe your goal, objective, or accomplishment…" style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div><div style={lbl}>Outcome</div><select value={g.outcome} onChange={e => updateGoal(i, 'outcome', e.target.value)} disabled={isSubmitted} style={{ ...inp, appearance: 'none' }}><option value="">— Select —</option><option value="successful">✓ Successful</option><option value="unsuccessful">✗ Unsuccessful</option></select></div>
                <div>
                  <div style={lbl}>Reason / Explanation</div>
                  <input value={g.reasoning} onChange={e => updateGoal(i, 'reasoning', e.target.value)} disabled={isSubmitted} placeholder="Why successful or unsuccessful?" style={inp} />
                  {!isSubmitted && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      {goalAI[i]?.error && <span style={{ fontSize: 10, color: '#f87171' }}>{goalAI[i].error}</span>}
                      <button
                        onClick={() => draftGoalExplanation(i)}
                        disabled={!g.description.trim() || !g.outcome || !!goalAI[i]?.loading}
                        title={!g.description.trim() || !g.outcome ? 'Fill in description and outcome first' : undefined}
                        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: (!g.description.trim() || !g.outcome) ? 'not-allowed' : 'pointer', color: '#818cf8', fontSize: 11, fontWeight: 600, padding: 0, opacity: (!g.description.trim() || !g.outcome) ? 0.3 : 1 }}>
                        {goalAI[i]?.loading ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Sparkles size={11} /> AI Draft</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isSubmitted && review.goals_objectives.length < 5 && (
            <button onClick={() => setReview(r => ({ ...r, goals_objectives: [...r.goals_objectives, { description: '', outcome: '', reasoning: '' }] }))} style={{ width: '100%', padding: '8px', background: 'transparent', color: '#10b981', border: '1px dashed #1a4a35', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={13} /> Add Goal / Accomplishment</button>
          )}
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 4 }}>Overall Performance Rating</div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>Select the rating that best reflects your overall performance this review period.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[5, 4, 3, 2, 1].map(n => {
              const s = STAR_LABELS[n]; const sel = review.overall_rating === n
              return (
                <button key={n} onClick={() => !isSubmitted && setReview(r => ({ ...r, overall_rating: n }))} disabled={isSubmitted}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${sel ? s.color : '#1e2130'}`, background: sel ? s.color + '15' : '#0d1117', cursor: isSubmitted ? 'default' : 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 15, color: s.color, fontWeight: 800, minWidth: 80, letterSpacing: -1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</div>
                  <div><div style={{ fontWeight: 700, color: sel ? s.color : '#9ca3af', fontSize: 13 }}>{n} — {s.label}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{s.description}</div></div>
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
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6, flex: 1 }}>Identify at least two goals for the next review period with a roadmap for how you plan to reach each one. These will be discussed with your manager.</p>
          {!isSubmitted && (
            <div style={{ flexShrink: 0 }}>
              <button
                onClick={draftNextYearGoals}
                disabled={nextYearAI.loading || !hasConstructive}
                title={!hasConstructive ? 'Fill in your constructive competencies (steps 3–4) first' : 'Generate SMART goals based on your constructive competency areas'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: hasConstructive ? 'rgba(126,105,228,0.8)' : '#1e2130', color: hasConstructive ? '#fff' : '#4b5563', border: `1px solid ${hasConstructive ? 'rgba(129,140,248,0.4)' : '#2a2d3a'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (nextYearAI.loading || !hasConstructive) ? 'not-allowed' : 'pointer' }}>
                {nextYearAI.loading ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : <><Sparkles size={12} /> AI Draft Goals</>}
              </button>
              {!hasConstructive && <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4, textAlign: 'right' }}>Fill constructive competencies first</div>}
            </div>
          )}
        </div>
        {nextYearAI.error && <div style={{ padding: '8px 12px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#f87171', fontSize: 12, marginBottom: 12 }}>{nextYearAI.error}</div>}
        {review.next_year_goals.map((g, i) => (
          <div key={i} style={{ ...card, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: '#f59e0b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goal {i + 1}</div>
            <div style={{ marginBottom: 10 }}><div style={lbl}>Goal</div><input value={g.goal} onChange={e => updateNext(i, 'goal', e.target.value)} disabled={isSubmitted} placeholder="e.g. Improve public speaking skills" style={inp} /></div>
            <div><div style={lbl}>Objective / Roadmap</div><textarea value={g.objective} onChange={e => updateNext(i, 'objective', e.target.value)} disabled={isSubmitted} rows={2} placeholder="e.g. Attend a public speaking course and practice presentations quarterly" style={{ ...inp, resize: 'vertical' }} /></div>
          </div>
        ))}
        {!isSubmitted && review.next_year_goals.length < 5 && (
          <button onClick={() => setReview(r => ({ ...r, next_year_goals: [...r.next_year_goals, { goal: '', objective: '' }] }))} style={{ width: '100%', padding: '8px', background: 'transparent', color: '#f59e0b', border: '1px dashed #92400e', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={13} /> Add Another Goal</button>
        )}
      </div>
    )
    }

    if (step === 8) return (
      <div>
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 14 }}>Assessment Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><div style={lbl}>Employee</div><div style={{ fontSize: 13, color: '#e5e7eb' }}>{profileName || profile.email}</div></div>
            <div><div style={lbl}>Supervisor</div><div style={{ fontSize: 13, color: '#e5e7eb' }}>{manager?.name || manager?.email || '—'}</div></div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Part One — Competencies</div>
          {review.competencies.map((c, i) => c.term ? (
            <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${COMP_CONFIG[i].accent}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{COMP_CONFIG[i].label} <span style={{ color: '#6b7280', fontWeight: 400 }}>({COMP_CONFIG[i].sublabel})</span> — {c.term}</div>
              {c.examples.filter(Boolean).map((ex, j) => <div key={j} style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{j + 1}. {ex}</div>)}
            </div>
          ) : <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6, fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>{COMP_CONFIG[i].label} — not filled</div>)}
          <div style={{ fontSize: 10, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Part Two — Goals & Rating</div>
          {review.goals_objectives.filter(g => g.description).map((g, i) => (
            <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{i + 1}. {g.description}</div>
              {g.outcome && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Outcome: {g.outcome}</div>}
            </div>
          ))}
          {review.overall_rating ? (
            <div style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6 }}>
              <span style={{ color: STAR_LABELS[review.overall_rating].color }}>{'★'.repeat(review.overall_rating)}</span>
              {' '}<span style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{review.overall_rating}/5 — {STAR_LABELS[review.overall_rating].label}</span>
            </div>
          ) : <div style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>No rating selected</div>}
          <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Part Three — Next Year&apos;s Goals</div>
          {review.next_year_goals.filter(g => g.goal).map((g, i) => (
            <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{i + 1}. {g.goal}</div>
              {g.objective && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{g.objective}</div>}
            </div>
          ))}
        </div>

        {!isSubmitted ? (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>Ready to submit?</div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>Once submitted, your self-assessment is shared with your manager and cannot be edited. You&apos;ll then be able to export it to Google Drive.</p>
            <button onClick={() => setSubmitConfirm(true)} style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Submit Self-Assessment</button>
          </div>
        ) : driveUrl ? (
          <div style={{ ...card, background: '#0d1a13', border: '1px solid #1a4a35' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 22 }}>✅</div>
              <div style={{ fontWeight: 700, color: '#34d399', fontSize: 14 }}>Saved to Google Drive</div>
            </div>
            <div style={{ fontSize: 11, color: '#34d399', background: '#0a1f13', border: '1px solid #1a4a35', borderRadius: 8, padding: '7px 12px', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driveUrl}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1a4a35', color: '#34d399', borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: 'none', border: '1px solid #2a6b4a' }}><ExternalLink size={12} /> Open in Google Docs</a>
              <button onClick={sendToDrive} disabled={exporting} style={{ padding: '8px 14px', background: 'transparent', color: '#6b7280', borderRadius: 8, fontSize: 12, border: '1px solid #2a2d3a', cursor: 'pointer' }}>Re-export</button>
              <button onClick={() => { setShowManualLink(true); setManualLinkValue(driveUrl ?? '') }} style={{ padding: '8px 14px', background: 'transparent', color: '#6b7280', borderRadius: 8, fontSize: 12, border: '1px solid #2a2d3a', cursor: 'pointer' }}>Replace link</button>
            </div>
            {showManualLink && (
              <div style={{ marginTop: 12, padding: '12px', background: '#0d1117', border: '1px solid #2a2d3a', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Paste a Google Docs or Drive URL:</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={manualLinkValue} onChange={e => { setManualLinkValue(e.target.value); setManualLinkError('') }} onKeyDown={e => { if (e.key === 'Enter') saveManualDriveLink() }} placeholder="https://docs.google.com/document/d/..." style={{ ...inp, flex: 1, fontSize: 12 }} />
                  <button onClick={saveManualDriveLink} disabled={manualLinkSaving || !manualLinkValue.trim()} style={{ padding: '8px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{manualLinkSaving ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => { setShowManualLink(false); setManualLinkError('') }} style={{ padding: '8px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
                </div>
                {manualLinkError && <div style={{ fontSize: 11, color: '#f87171' }}>{manualLinkError}</div>}
              </div>
            )}
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>Export to Google Drive</div>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>A formatted Google Doc will be created in the Performance Reviews folder.</p>
            {!approved ? (
              <button onClick={() => setApproved(true)} style={{ width: '100%', padding: '10px', background: '#13151f', color: '#e5e7eb', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Confirm accuracy and approve for export</button>
            ) : (
              <div>
                <div style={{ padding: '8px 12px', background: '#0d1a13', border: '1px solid #1a4a35', borderRadius: 8, color: '#34d399', fontSize: 12, marginBottom: 12 }}>✓ Approved — ready to export</div>
                {exportError && <div style={{ padding: '8px 12px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#f87171', fontSize: 12, marginBottom: 12 }}>{exportError}</div>}
                <button onClick={sendToDrive} disabled={exporting} style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {exporting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating Google Doc…</> : <><Send size={14} /> Send to Google Drive</>}
                </button>
              </div>
            )}
            {/* Manual link entry */}
            <div style={{ marginTop: 12, borderTop: '1px solid #1e2130', paddingTop: 12 }}>
              {!showManualLink ? (
                <button onClick={() => setShowManualLink(true)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Already have a doc? Paste the link manually
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Paste a Google Docs or Drive URL:</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input value={manualLinkValue} onChange={e => { setManualLinkValue(e.target.value); setManualLinkError('') }} onKeyDown={e => { if (e.key === 'Enter') saveManualDriveLink() }} placeholder="https://docs.google.com/document/d/..." style={{ ...inp, flex: 1, fontSize: 12 }} />
                    <button onClick={saveManualDriveLink} disabled={manualLinkSaving || !manualLinkValue.trim()} style={{ padding: '8px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: (!manualLinkValue.trim() || manualLinkSaving) ? 0.6 : 1 }}>{manualLinkSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => { setShowManualLink(false); setManualLinkError('') }} style={{ padding: '8px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
                  </div>
                  {manualLinkError && <div style={{ fontSize: 11, color: '#f87171' }}>{manualLinkError}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
    return null
  }

  // ── Page: Performance Reviews ─────────────────────────────────────────────
  function renderReviewsPage() {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Performance Reviews</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>Your submitted self-assessments and manager performance reviews.</p>

        <div style={{ fontWeight: 600, fontSize: 11, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Your Self-Assessments</div>
        {isSubmitted ? (
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#e5e7eb' }}>Self-Assessment</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Submitted {review.submitted_at ? new Date(review.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                {review.overall_rating && <> · <span style={{ color: STAR_LABELS[review.overall_rating].color }}>{'★'.repeat(review.overall_rating)}</span> {STAR_LABELS[review.overall_rating].label}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {driveUrl && <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#0d1a13', color: '#34d399', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid #1a4a35' }}><ExternalLink size={12} /> Drive</a>}
              <button onClick={() => { setPage('self-assessment'); setStep(8) }} style={{ padding: '6px 12px', background: '#13151f', color: '#9ca3af', border: '1px solid #1e2130', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>View</button>
            </div>
          </div>
        ) : (
          <div style={{ ...card, background: '#0d1117', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>No submitted self-assessments yet</div>
            <button onClick={() => setPage('self-assessment')} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Start Self-Assessment</button>
          </div>
        )}

        <div style={{ fontWeight: 600, fontSize: 11, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '24px 0 10px' }}>Manager Performance Reviews</div>
        <div style={{ ...card, background: '#0d1117', textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>Coming soon</div>
          <p style={{ margin: 0, fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>When your manager completes and shares your annual performance review, it will appear here with your rating and Drive link.</p>
        </div>
      </div>
    )
  }

  // ── Page: Goals Tracker ───────────────────────────────────────────────────
  const STATUS_CONFIG = {
    not_started: { label: 'Not Started', color: '#6b7280', bg: '#13151f' },
    in_progress:  { label: 'In Progress', color: '#f59e0b', bg: '#1f1a0d' },
    complete:     { label: 'Complete',    color: '#34d399', bg: '#0d1a13' },
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
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Goals Tracker</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Track your progress between review cycles. Goals can pre-populate your next self-assessment.</p>
          </div>
          <button onClick={() => { setShowAddGoal(true); setGoalForm({ title: '', description: '', status: 'not_started', target_date: '', notes: '' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={14} /> Add Goal
          </button>
        </div>

        {/* Stats */}
        {goals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total', value: goals.length, color: '#9ca3af' },
              { label: 'In Progress', value: inProgress, color: '#f59e0b' },
              { label: 'Complete', value: complete, color: '#34d399' },
              { label: 'Overdue', value: overdue, color: overdue > 0 ? '#f87171' : '#4b5563' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add goal form */}
        {showAddGoal && (
          <div style={{ ...card, border: '1px solid rgba(79,70,229,0.4)', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 14 }}>New Goal</div>
            {formFields}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowAddGoal(false)} style={{ flex: 1, padding: '9px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={createGoal} disabled={goalSaving || !goalForm.title.trim()} style={{ flex: 2, padding: '9px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!goalForm.title.trim() || goalSaving) ? 0.6 : 1 }}>
                {goalSaving ? 'Saving…' : 'Add Goal'}
              </button>
            </div>
          </div>
        )}

        {/* Goals list */}
        {goalsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: 13 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} /><br />Loading goals…</div>
        ) : goals.length === 0 ? (
          <div style={{ ...card, background: '#0d1117', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>No goals yet</div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#4b5563', lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
              Add goals between review cycles to track your progress. Your active goals can carry forward into your next self-assessment.
            </p>
            <button onClick={() => setShowAddGoal(true)} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add Your First Goal</button>
          </div>
        ) : (
          goals.map(g => {
            const sc = STATUS_CONFIG[g.status]
            const isEditing = editingGoal?.id === g.id
            const isOverdue = g.target_date && g.status !== 'complete' && new Date(g.target_date) < new Date()
            return (
              <div key={g.id} style={{ ...card, borderLeft: `3px solid ${sc.color}`, background: isEditing ? '#1e1f3a' : '#13151f' }}>
                {isEditing ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#818cf8', marginBottom: 14 }}>Editing Goal</div>
                    {formFields}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button onClick={() => setEditingGoal(null)} style={{ flex: 1, padding: '8px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      <button onClick={saveEditGoal} disabled={goalSaving} style={{ flex: 2, padding: '8px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{goalSaving ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{g.title}</div>
                        {g.description && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, lineHeight: 1.5 }}>{g.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {/* Quick status toggle */}
                        {g.status !== 'complete' && (
                          <button onClick={() => updateGoalRecord(g.id, { status: g.status === 'not_started' ? 'in_progress' : 'complete' })}
                            title={g.status === 'not_started' ? 'Mark In Progress' : 'Mark Complete'}
                            style={{ padding: '4px 8px', background: '#1e2130', color: '#9ca3af', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                            {g.status === 'not_started' ? '▶ Start' : '✓ Done'}
                          </button>
                        )}
                        <button onClick={() => { setEditingGoal(g); setGoalForm({ title: g.title, description: g.description, status: g.status, target_date: g.target_date, notes: g.notes }) }}
                          style={{ padding: '4px 8px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteGoal(g.id)} style={{ padding: '4px 8px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>{sc.label}</span>
                      {g.target_date && (
                        <span style={{ fontSize: 11, color: isOverdue ? '#f87171' : '#6b7280' }}>
                          {isOverdue ? '⚠ Overdue · ' : '📅 '}{new Date(g.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {g.notes && <div style={{ marginTop: 10, padding: '8px 12px', background: '#0d1117', borderRadius: 8, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{g.notes}</div>}
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
    const events: { icon: string; label: string; time: string; color: string }[] = []
    if (review.submitted_at) events.push({ icon: '✅', label: 'Self-assessment submitted', time: new Date(review.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: '#34d399' })
    if (driveUrl) events.push({ icon: '📤', label: 'Exported to Google Drive', time: 'Recent', color: '#818cf8' })
    if (review.status === 'draft') events.push({ icon: '💾', label: 'Draft in progress', time: 'Auto-saved', color: '#f59e0b' })

    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Review Timeline</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>A chronological log of your review activity and milestones.</p>
        {events.length === 0 ? (
          <div style={{ ...card, background: '#0d1117', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🕐</div>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>No activity recorded yet</div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 19, top: 8, bottom: 8, width: 2, background: '#1e2130' }} />
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#13151f', border: `2px solid ${e.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, zIndex: 1 }}>{e.icon}</div>
                <div style={{ flex: 1, padding: '10px 14px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{e.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Page: Employee Guide ──────────────────────────────────────────────────
  function renderGuidePage() {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Employee Guide to Self-Assessments</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Reference this guide when completing your self-assessment.</p>

        <p style={{ ...card as object, fontSize: 13, color: '#9ca3af', lineHeight: 1.7, display: 'block' } as React.CSSProperties}>
          This self-assessment provides you an opportunity to reflect on your performance during the review period, set goals, and identify areas for development. It will also help prepare you for the evaluation discussion with your supervisor.
        </p>

        {[
          { title: 'Preparation', accent: '#818cf8', content: 'Prepare your self-assessment by reviewing your job description and past evaluations, and gathering relevant documentation to give a reason for your evaluation of your performance.' },
          { title: 'Components of a Self-Assessment', accent: '#818cf8', content: 'The self-assessment components include a 5-Word Competency assessment, goal/objective successful or unsuccessful completion, and accomplishments. Make sure you indicate any challenges you faced and any training or development needs.' },
          { title: 'Tips', accent: '#818cf8', content: 'As you reflect on your performance, make sure you are honest with yourself, use specific examples, stay professional, and reflect on any periodic feedback you have received from management throughout the year.' },
          { title: 'Mistakes to Avoid', accent: '#f87171', content: '• Avoid generalized or vague statements — be specific about accomplishments and areas for growth.\n• Don\'t shy away from discussing difficulties; they are part of your growth journey.\n• Don\'t ignore input from others — take feedback, positive and constructive, to heart.' },
        ].map(s => (
          <div key={s.title} style={{ ...card, borderLeft: `3px solid ${s.accent}` }}>
            <div style={{ fontWeight: 700, color: s.accent, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#f0f2fa', fontSize: 14, marginBottom: 14 }}>Rush Media Star Rating Matrix</div>
          {[5, 4, 3, 2, 1].map(n => {
            const s = STAR_LABELS[n]
            return (
              <div key={n} style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#0d1117', borderRadius: 8 }}>
                <div style={{ fontSize: 16, color: s.color, fontWeight: 800, minWidth: 24 }}>{n}</div>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{s.description}</div></div>
              </div>
            )
          })}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#f0f2fa', fontSize: 14, marginBottom: 14 }}>SMART Goal Method</div>
          {[['S', 'Specific', 'Goals should be specific and narrow enough for effective planning and attainability.'], ['M', 'Measurable', 'Define how progress towards the goal will be made.'], ['A', 'Attainable', 'Ensure goals are accomplished reasonably within a certain timeframe.'], ['R', 'Relevant', 'Goals should align with Company values and your job description.'], ['T', 'Time-Bound', 'Set a realistic date and stick to it.']].map(([l, w, d]) => (
            <div key={l} style={{ display: 'flex', gap: 14, marginBottom: 8, padding: '8px 12px', background: '#0d1117', borderRadius: 8 }}>
              <div style={{ fontWeight: 800, color: '#818cf8', fontSize: 16, minWidth: 18 }}>{l}</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#c4c9d4' }}>{w}</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{d}</div></div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#f0f2fa', fontSize: 14, marginBottom: 14 }}>Goals vs. Objectives vs. Accomplishments</div>
          {[
            { title: 'Goal', color: '#818cf8', desc: 'Broad, longer-term, achievable outcomes agreed upon by the employee and manager as a plan of action for the following review cycle.', example: 'Improve public speaking skills.' },
            { title: 'Objective', color: '#34d399', desc: 'Shorter, more specific, measurable steps toward achieving a goal. Generally determined by the employee with manager support.', example: 'Attend a public speaking course and practice presentations to a colleague one time per quarter.' },
            { title: 'Accomplishment', color: '#fbbf24', desc: 'Tangible achievements or milestones from pursuing goals and objectives — what has been successfully met regardless of whether it was part of the goal-planning process.', example: 'Successfully delivered a presentation at a Company-wide meeting that received positive feedback from senior management.' },
          ].map(item => (
            <div key={item.title} style={{ marginBottom: 12, padding: '12px 14px', background: '#0d1117', borderRadius: 8, borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginBottom: 6 }}>{item.desc}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Example: {item.example}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, color: '#f0f2fa', fontSize: 14, marginBottom: 12 }}>Questions to Ask Yourself</div>
          {['How do you perform on the team and in comparison to your colleagues?', 'Does your performance limit the success of your colleagues or does it help them?', 'Are you transparent with yourself about your performance?', 'Are you efficient?', 'What is one small thing you would change that you feel would have the biggest impact to your performance?', 'How would you describe your work ethic in one word?', 'Where have you made the most progress?', 'What makes you most proud?', 'Where have you had the most impact on others and what word best describes that impact?'].map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #1e2130', fontSize: 13, color: '#9ca3af' }}>
              <span style={{ color: '#818cf8', fontSize: 10, marginTop: 4, flexShrink: 0 }}>▸</span> {q}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Page: Glossary ────────────────────────────────────────────────────────
  function renderGlossaryPage() {
    const filtered = COMPETENCY_TERMS.filter(t =>
      t.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      t.definition.toLowerCase().includes(glossarySearch.toLowerCase())
    )
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Competency Glossary of Terms</h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Use these definitions when selecting your competency words in Part One of the self-assessment.</p>
        <input value={glossarySearch} onChange={e => setGlossarySearch(e.target.value)} placeholder="Search by term or definition…" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: '#4b5563' }}>{filtered.length} of {COMPETENCY_TERMS.length} terms</span>
        </div>
        {filtered.map(t => (
          <div key={t.term} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 14, marginBottom: 5 }}>{t.term}</div>
            <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>{t.definition}</div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#374151', fontSize: 14 }}>No matching competencies found.</div>}
      </div>
    )
  }

  // ── Notification Bell ─────────────────────────────────────────────────────
  function NotificationBell() {
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifications(n => !n)}
          style={{ position: 'relative', width: 34, height: 34, borderRadius: 8, background: showNotifications ? '#1e1f3a' : 'transparent', border: '1px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#13151f'; e.currentTarget.style.borderColor = '#2a2d3a' }}
          onMouseLeave={e => { if (!showNotifications) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}>
          <Bell size={16} />
          {notifications.length > 0 && (
            <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', border: '1.5px solid #0d0f1a' }} />
          )}
        </button>
        {showNotifications && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowNotifications(false)} />
            <div style={{ position: 'absolute', right: 0, top: 40, width: 320, background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2130', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Notifications</span>
                {notifications.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#f59e0b20', color: '#f59e0b', padding: '1px 6px', borderRadius: 10 }}>{notifications.length}</span>}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🔔</div>
                  All caught up!
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} onClick={() => { if (n.action) { n.action(); setShowNotifications(false) } }}
                    style={{ padding: '12px 16px', borderBottom: '1px solid #1e2130', cursor: n.action ? 'pointer' : 'default', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                    onMouseEnter={e => { if (n.action) e.currentTarget.style.background = '#0d1117' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>{n.label}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{n.detail}</div>
                      {n.action && <div style={{ fontSize: 11, color: n.color, marginTop: 4, fontWeight: 600 }}>View →</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const displayName = profileName || profile.email

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#f0f2fa', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: collapsed ? 56 : 240, flexShrink: 0, background: '#0d0f1a', borderRight: '1px solid #1e2130', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden' }}>

        {/* Logo + collapse */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: collapsed ? '0 12px' : '0 16px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
          {!collapsed && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16 }}>⭐</span><span style={{ fontWeight: 700, fontSize: 13, color: '#f0f2fa', whiteSpace: 'nowrap' }}>Performance Review</span></div>}
          {collapsed && <span style={{ fontSize: 16 }}>⭐</span>}
          <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 8px 6px', marginBottom: 2 }}>Menu</div>}
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            const Icon = item.icon
            return (
              <button key={item.id} onClick={() => setPage(item.id)} title={collapsed ? item.label : undefined}
                style={navBtn(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <Icon size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!collapsed && item.label}
                {/* Draft indicator on self-assessment */}
                {item.id === 'self-assessment' && !collapsed && !isSubmitted && (
                  <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                )}
                {item.id === 'self-assessment' && !collapsed && isSubmitted && (
                  <CheckCircle2 size={11} color="#34d399" style={{ marginLeft: 'auto' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: collapsed ? '8px' : '8px 10px', borderTop: '1px solid #1e2130', flexShrink: 0 }}>
          {/* Auto-save status */}
          {!collapsed && page === 'self-assessment' && !isSubmitted && (
            <div style={{ padding: '5px 8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: '#6b7280' }} /><span style={{ fontSize: 11, color: '#6b7280' }}>Saving…</span></> : saved ? <><CheckCircle2 size={10} color="#34d399" /><span style={{ fontSize: 11, color: '#34d399' }}>Saved</span></> : <span style={{ fontSize: 11, color: '#4b5563' }}>Auto-saves</span>}
            </div>
          )}

          {/* Supervisor — always visible */}
          {!collapsed && (
            <div style={{ padding: '7px 8px', marginBottom: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Supervisor</div>
              {manager ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(manager.name || manager.email).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#c4c9d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{manager.name || manager.email}</div>
                    {manager.name && <div style={{ fontSize: 10, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{manager.email}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>Not assigned</div>
              )}
            </div>
          )}
          {collapsed && manager && (
            <div title={manager.name || manager.email} style={{ display: 'flex', justifyContent: 'center', padding: '6px 0', marginBottom: 2 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                {(manager.name || manager.email).charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Profile — clickable */}
          <button onClick={() => setShowProfileEdit(true)} title={collapsed ? displayName : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', borderRadius: 8, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#13151f'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#c4c9d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10, color: '#4b5563' }}>Employee · Edit profile</div>
              </div>
            )}
            {!collapsed && <Pencil size={11} color="#4b5563" />}
          </button>

          {/* Sign out */}
          <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }} title={collapsed ? 'Sign out' : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', borderRadius: 8, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', marginTop: 2 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a1010'; (e.currentTarget.querySelector('span') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('span') as HTMLElement).style.color = '#f87171') }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; (e.currentTarget.querySelector('span') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('span') as HTMLElement).style.color = '#6b7280') }}>
            <LogOut size={14} color="#6b7280" />
            {!collapsed && <span style={{ fontSize: 12, color: '#6b7280', transition: 'color 0.15s' }}>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Self Assessment: step tabs + progress */}
        {page === 'self-assessment' && (
          <>
            {/* Manager strip */}
            <div style={{ height: 40, background: '#0d0f1a', borderBottom: '1px solid #1e2130', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#f0f2fa' }}>Self Assessment</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#4b5563' }}>Supervisor:</span>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                  {(manager?.name || manager?.email || '?').charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#c4c9d4' }}>{manager?.name || manager?.email || 'Not assigned'}</span>
                <NotificationBell />
              </div>
            </div>
            {renderStepTabs()}
            <div style={{ height: 3, background: '#1e2130', flexShrink: 0 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', width: `${(step / (SA_STEPS.length - 1)) * 100}%`, transition: 'width 0.3s ease' }} />
            </div>
          </>
        )}

        {/* Other pages: header bar with notification bell */}
        {page !== 'self-assessment' && (
          <div style={{ height: 56, background: '#0d0f1a', borderBottom: '1px solid #1e2130', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#c4c9d4' }}>{NAV_ITEMS.find(n => n.id === page)?.label}</span>
            <NotificationBell />
          </div>
        )}


        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {page === 'self-assessment' && (
            <div style={{ padding: '24px 32px', maxWidth: 720, margin: '0 auto' }}>
              {renderSAStep()}
            </div>
          )}
          {page === 'reviews'  && renderReviewsPage()}
          {page === 'timeline' && renderTimelinePage()}
          {page === 'goals'    && renderGoalsPage()}
          {page === 'guide'    && renderGuidePage()}
          {page === 'glossary' && renderGlossaryPage()}
        </div>

        {/* Self Assessment bottom nav */}
        {page === 'self-assessment' && (
          <div style={{ height: 60, background: '#0d0f1a', borderTop: '1px solid #1e2130', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={() => goStep(step - 1)} disabled={step === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'transparent', color: step > 0 ? '#9ca3af' : '#374151', border: `1px solid ${step > 0 ? '#2a2d3a' : '#1e2130'}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: step > 0 ? 'pointer' : 'default' }}>
              <ChevronLeft size={14} /> Back
            </button>
            <div style={{ display: 'flex', gap: 5 }}>
              {SA_STEPS.map((_, i) => (
                <div key={i} onClick={() => goStep(i)} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? '#6366f1' : i < step ? '#4f46e5' : '#1e2130', transition: 'all 0.2s', cursor: 'pointer' }} />
              ))}
            </div>
            {step < SA_STEPS.length - 1 ? (
              <button onClick={() => goStep(step + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Next <ChevronRight size={14} />
              </button>
            ) : <div style={{ width: 80 }} />}
          </div>
        )}
      </main>

      {/* ── Profile edit modal ── */}
      {showProfileEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setShowProfileEdit(false) }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: 28, width: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0f2fa' }}>Edit Profile</h2>
              <button onClick={() => setShowProfileEdit(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Display Name</div>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={lbl}>Email</div>
              <input value={profile.email} disabled style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>Email is managed by your Google account and cannot be changed here.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowProfileEdit(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveProfile} disabled={profileSaving || !profileName.trim()} style={{ flex: 2, padding: '10px', background: profileSaved ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (!profileName.trim() || profileSaving) ? 0.6 : 1 }}>
                {profileSaved ? <><Check size={14} /> Saved!</> : profileSaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit confirmation ── */}
      {submitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 17, color: '#f0f2fa' }}>Submit Self-Assessment?</h2>
            <p style={{ margin: '0 0 22px', color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>Once submitted, your self-assessment will be shared with your manager and cannot be edited.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSubmitConfirm(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Go Back</button>
              <button onClick={submitReview} disabled={saving} style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
