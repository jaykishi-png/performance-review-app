'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  FileText, BookOpen, BookMarked, Send, LogOut,
  CheckCircle2, Star, Plus, X, Loader2, ExternalLink,
  User, Users, RefreshCw,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Glossary ──────────────────────────────────────────────────────────────────

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

const STAR_LABELS: Record<number, { label: string; description: string }> = {
  5: { label: 'Outstanding', description: 'Consistently exceeds performance requirements.' },
  4: { label: 'Exceeds Job Requirements', description: 'Meets and at times exceeds performance requirements (above average).' },
  3: { label: 'Meets Expectations', description: 'Job requirements are being met at a satisfactory level.' },
  2: { label: 'Needs Improvement', description: 'Does not consistently meet the expected job requirements.' },
  1: { label: 'Unsatisfactory', description: 'Demonstrates an unacceptable level of skills and competencies.' },
}

const COMP_CONFIG: { type: CompetencyType; label: string; sublabel: string; accent: string }[] = [
  { type: 'positive',     label: 'Competency 1', sublabel: 'Positive',     accent: '#10b981' },
  { type: 'positive',     label: 'Competency 2', sublabel: 'Positive',     accent: '#10b981' },
  { type: 'constructive', label: 'Competency 3', sublabel: 'Constructive', accent: '#f97316' },
  { type: 'constructive', label: 'Competency 4', sublabel: 'Constructive', accent: '#f97316' },
  { type: 'choice',       label: 'Competency 5', sublabel: 'Your Choice',  accent: '#818cf8' },
]

const STEPS = [
  { id: 'info',   label: 'Employee Info',     icon: User,       part: null        },
  { id: 'comp1',  label: 'Competency 1',      icon: Star,       part: 'PART ONE'  },
  { id: 'comp2',  label: 'Competency 2',      icon: Star,       part: 'PART ONE'  },
  { id: 'comp3',  label: 'Competency 3',      icon: Star,       part: 'PART ONE'  },
  { id: 'comp4',  label: 'Competency 4',      icon: Star,       part: 'PART ONE'  },
  { id: 'comp5',  label: 'Competency 5',      icon: Star,       part: 'PART ONE'  },
  { id: 'goals',  label: 'Goals & Rating',    icon: CheckCircle2, part: 'PART TWO'  },
  { id: 'next',   label: "Next Year's Goals", icon: RefreshCw,  part: 'PART THREE' },
  { id: 'output', label: 'Review & Export',   icon: Send,       part: null        },
]

// ── Defaults ──────────────────────────────────────────────────────────────────

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
    competencies: saved.competencies?.length ? saved.competencies : d.competencies,
    goals_objectives: saved.goals_objectives?.length ? saved.goals_objectives : d.goals_objectives,
    next_year_goals: saved.next_year_goals?.length ? saved.next_year_goals : d.next_year_goals,
  }
}

function isStepComplete(stepIdx: number, review: SelfReview): boolean {
  switch (stepIdx) {
    case 0: return true
    case 1: return !!(review.competencies[0]?.term && review.competencies[0]?.examples[0]?.trim())
    case 2: return !!(review.competencies[1]?.term && review.competencies[1]?.examples[0]?.trim())
    case 3: return !!(review.competencies[2]?.term && review.competencies[2]?.examples[0]?.trim())
    case 4: return !!(review.competencies[3]?.term && review.competencies[3]?.examples[0]?.trim())
    case 5: return !!(review.competencies[4]?.term && review.competencies[4]?.examples[0]?.trim())
    case 6: return !!(review.goals_objectives.some(g => g.description.trim()) && review.overall_rating)
    case 7: return review.next_year_goals.some(g => g.goal.trim())
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
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [review, setReview] = useState<SelfReview>(() => mergeReview(initialSelfReview))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [driveUrl, setDriveUrl] = useState<string | null>(initialDriveUrl ?? null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [glossarySearch, setGlossarySearch] = useState('')

  const isSubmitted = review.status === 'submitted'

  // Auto-save debounce
  useEffect(() => {
    if (isSubmitted) return
    const t = setTimeout(() => { saveDraft() }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review])

  function goTo(s: number) {
    setStep(s)
    setMaxStep(m => Math.max(m, s))
  }
  function next() { goTo(Math.min(step + 1, STEPS.length - 1)) }
  function back() { goTo(Math.max(step - 1, 0)) }

  async function saveDraft() {
    setSaving(true)
    try {
      await fetch('/api/self-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencies: review.competencies,
          goalsObjectives: review.goals_objectives,
          nextYearGoals: review.next_year_goals,
          overallRating: review.overall_rating,
          status: 'draft',
          strengths: '', growthAreas: '', goalReflections: [], overallComments: '',
        }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  async function submit() {
    setSaving(true)
    try {
      await fetch('/api/self-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencies: review.competencies,
          goalsObjectives: review.goals_objectives,
          nextYearGoals: review.next_year_goals,
          overallRating: review.overall_rating,
          status: 'submitted',
          strengths: '', growthAreas: '', goalReflections: [], overallComments: '',
        }),
      })
      setReview(r => ({ ...r, status: 'submitted', submitted_at: new Date().toISOString() }))
      setSubmitConfirm(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  async function sendToDrive() {
    setExporting(true); setExportError(null)
    try {
      const today = new Date()
      const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const yr = today.getFullYear()
      const res = await fetch('/api/self-reviews/send-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfReviewId: selfReviewId ?? review.id,
          employeeName: profile.name || profile.email,
          employeePosition: '',
          supervisorName: manager?.name || manager?.email || '',
          appraisalPeriod: `${yr - 1} - ${yr}`,
          dateCompleted: dateStr,
          competencies: review.competencies.map(c => ({
            ...c, examples: c.examples as string[],
            definition: COMPETENCY_TERMS.find(t => t.term === c.term)?.definition ?? '',
          })),
          goalsObjectives: review.goals_objectives,
          overallRating: review.overall_rating,
          nextYearGoals: review.next_year_goals,
        }),
      })
      const data = await res.json() as { docUrl?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Export failed')
      setDriveUrl(data.docUrl ?? null)
    } catch (e) { setExportError(String(e)) }
    finally { setExporting(false) }
  }

  function updateComp(i: number, field: string, value: unknown) {
    setReview(r => {
      const c = [...r.competencies]; c[i] = { ...c[i], [field]: value }
      return { ...r, competencies: c }
    })
  }
  function updateExample(ci: number, ei: number, val: string) {
    setReview(r => {
      const c = [...r.competencies]
      const ex = [...c[ci].examples] as [string, string, string]; ex[ei] = val
      c[ci] = { ...c[ci], examples: ex }; return { ...r, competencies: c }
    })
  }
  function updateGoal(i: number, f: string, v: string) {
    setReview(r => { const g = [...r.goals_objectives]; g[i] = { ...g[i], [f]: v }; return { ...r, goals_objectives: g } })
  }
  function updateNext(i: number, f: string, v: string) {
    setReview(r => { const g = [...r.next_year_goals]; g[i] = { ...g[i], [f]: v }; return { ...r, next_year_goals: g } })
  }

  // ── Shared style tokens ────────────────────────────────────────────────────
  const input: React.CSSProperties = {
    width: '100%', background: '#0d0f1a', border: '1px solid #2a2d3a',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e5e7eb',
    boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
  }
  const textarea: React.CSSProperties = { ...input, resize: 'vertical' as const }
  const select: React.CSSProperties = { ...input }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
  }
  const card: React.CSSProperties = {
    background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '20px 22px', marginBottom: 14,
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '4px 8px 6px', marginBottom: 2,
  }

  // ── Step content renderer ──────────────────────────────────────────────────
  const currentStep = STEPS[step]

  function renderStepContent() {
    // Step 0 — Employee Info
    if (step === 0) return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Employee Info</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Review your information before starting your self-assessment. Contact your admin if anything is incorrect.
          </p>
        </div>
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {[
              { label: 'Your Name', value: profile.name || '—' },
              { label: 'Email', value: profile.email },
              { label: 'Supervisor', value: manager?.name || manager?.email || 'Not assigned' },
              { label: 'Review Status', value: isSubmitted ? '✓ Submitted' : 'Draft in progress' },
            ].map(({ label: l, value: v }) => (
              <div key={l}>
                <div style={label}>{l}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, background: '#0d1117', border: '1px solid #1e2130' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            <strong style={{ color: '#9ca3af' }}>About this self-assessment:</strong> You will evaluate five competency words
            (two positive, two constructive, and one of your choice), reflect on your goals and accomplishments,
            rate your overall performance, and set goals for the coming year. Use the{' '}
            <button onClick={() => setShowGuide(true)} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Employee Guide</button>{' '}
            and{' '}
            <button onClick={() => setShowGlossary(true)} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Competency Glossary</button>{' '}
            for reference at any time.
          </p>
        </div>
      </div>
    )

    // Steps 1–5 — Competencies
    if (step >= 1 && step <= 5) {
      const ci = step - 1
      const cfg = COMP_CONFIG[ci]
      const comp = review.competencies[ci]
      const def = COMPETENCY_TERMS.find(t => t.term === comp?.term)

      return (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.accent + '20', color: cfg.accent }}>
                {cfg.sublabel}
              </span>
              <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Part One</span>
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>{cfg.label}</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Select a competency from the glossary that reflects your performance, then provide 1–3 specific examples.{' '}
              <button onClick={() => setShowGlossary(true)} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                Browse Glossary →
              </button>
            </p>
          </div>

          <div style={{ ...card, borderLeft: `3px solid ${cfg.accent}` }}>
            <div style={label}>Competency Term</div>
            <select value={comp?.term || ''} onChange={e => updateComp(ci, 'term', e.target.value)}
              disabled={isSubmitted} style={select}>
              <option value="">— Select from glossary —</option>
              {COMPETENCY_TERMS.map(t => <option key={t.term} value={t.term}>{t.term}</option>)}
            </select>
            {def && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#0d1117', borderRadius: 8, fontSize: 12, color: '#9ca3af', lineHeight: 1.6, fontStyle: 'italic' }}>
                <strong style={{ color: '#6b7280', fontStyle: 'normal' }}>Definition: </strong>{def.definition}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ marginBottom: 14 }}>
              <div style={label}>Examples <span style={{ color: '#4b5563', fontWeight: 400, textTransform: 'none' }}>(provide 1–3 specific examples)</span></div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                Be specific. Reference actual situations, outcomes, and your impact. Avoid vague or general statements.
              </p>
            </div>
            {[0, 1, 2].map(ei => (
              <div key={ei} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 9,
                  background: comp?.examples[ei]?.trim() ? cfg.accent : '#1e2130',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: comp?.examples[ei]?.trim() ? '#fff' : '#4b5563',
                  transition: 'background 0.2s',
                }}>
                  {ei + 1}
                </div>
                <textarea
                  value={comp?.examples[ei] || ''}
                  onChange={e => updateExample(ci, ei, e.target.value)}
                  disabled={isSubmitted}
                  placeholder={ei === 0 ? 'Required — describe a specific situation, your actions, and the result' : 'Optional — add another example'}
                  rows={2}
                  style={{ ...textarea, flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Step 6 — Goals & Rating
    if (step === 6) return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Part Two</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Goals, Objectives & Rating</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Reflect on your goals and accomplishments from the review period, then rate your overall performance.
          </p>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 4 }}>Goals, Objectives & Accomplishments</div>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            Indicate the completion of your goals or objectives and explain the outcome. Include stand-alone accomplishments too.
          </p>
          {review.goals_objectives.map((g, i) => (
            <div key={i} style={{ padding: '14px 16px', background: '#0d1117', borderRadius: 10, marginBottom: 10, border: '1px solid #1e2130' }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: '#10b981', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {i + 1}. Goal / Objective / Accomplishment
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={label}>Description</div>
                <textarea value={g.description} onChange={e => updateGoal(i, 'description', e.target.value)}
                  disabled={isSubmitted} rows={2} placeholder="Describe your goal, objective, or accomplishment…" style={textarea} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <div style={label}>Outcome</div>
                  <select value={g.outcome} onChange={e => updateGoal(i, 'outcome', e.target.value)}
                    disabled={isSubmitted} style={select}>
                    <option value="">— Select —</option>
                    <option value="successful">✓ Successful</option>
                    <option value="unsuccessful">✗ Unsuccessful</option>
                  </select>
                </div>
                <div>
                  <div style={label}>Reason / Explanation</div>
                  <input value={g.reasoning} onChange={e => updateGoal(i, 'reasoning', e.target.value)}
                    disabled={isSubmitted} placeholder="Why successful or unsuccessful?" style={input} />
                </div>
              </div>
            </div>
          ))}
          {!isSubmitted && review.goals_objectives.length < 5 && (
            <button onClick={() => setReview(r => ({ ...r, goals_objectives: [...r.goals_objectives, { description: '', outcome: '', reasoning: '' }] }))}
              style={{ width: '100%', padding: '8px', background: 'transparent', color: '#10b981', border: '1px dashed #1a4a35', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={13} /> Add Goal / Accomplishment
            </button>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 4 }}>Overall Performance Rating</div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>
            Select the rating that best reflects your overall performance this review period.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[5, 4, 3, 2, 1].map(n => {
              const s = STAR_LABELS[n]
              const colors = { 5: '#a78bfa', 4: '#34d399', 3: '#fbbf24', 2: '#fb923c', 1: '#f87171' }
              const c = colors[n as keyof typeof colors]
              const sel = review.overall_rating === n
              return (
                <button key={n} onClick={() => !isSubmitted && setReview(r => ({ ...r, overall_rating: n }))}
                  disabled={isSubmitted}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10,
                    border: `1.5px solid ${sel ? c : '#1e2130'}`, background: sel ? c + '15' : '#0d1117',
                    cursor: isSubmitted ? 'default' : 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 16, color: c, fontWeight: 800, minWidth: 80, letterSpacing: -1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: sel ? c : '#9ca3af', fontSize: 13 }}>{n} — {s.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{s.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )

    // Step 7 — Next Year's Goals
    if (step === 7) return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Part Three</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Next Year&apos;s Goals</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Identify at least two goals for the next review period with a roadmap (objective) for how you plan to reach each one.
            These will be discussed with your manager and may change based on that conversation.
          </p>
        </div>

        {review.next_year_goals.map((g, i) => (
          <div key={i} style={{ ...card, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#f59e0b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Goal {i + 1}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={label}>Goal</div>
              <input value={g.goal} onChange={e => updateNext(i, 'goal', e.target.value)}
                disabled={isSubmitted} placeholder="e.g. Improve public speaking skills" style={input} />
            </div>
            <div>
              <div style={label}>Objective / Roadmap</div>
              <textarea value={g.objective} onChange={e => updateNext(i, 'objective', e.target.value)}
                disabled={isSubmitted} rows={2} placeholder="e.g. Attend a public speaking course and practice presentations quarterly" style={textarea} />
            </div>
          </div>
        ))}

        {!isSubmitted && review.next_year_goals.length < 5 && (
          <button onClick={() => setReview(r => ({ ...r, next_year_goals: [...r.next_year_goals, { goal: '', objective: '' }] }))}
            style={{ width: '100%', padding: '8px', background: 'transparent', color: '#f59e0b', border: '1px dashed #92400e', borderRadius: 8, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
            <Plus size={13} /> Add Another Goal
          </button>
        )}

        {!isSubmitted && (
          <div style={{ ...card, background: '#0d1117', border: '1px solid #1e2130' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
              <strong style={{ color: '#9ca3af' }}>Tip (SMART Goals):</strong> Make each goal Specific, Measurable, Attainable, Relevant, and Time-bound.
              Your objective should describe HOW you plan to reach the goal — specific steps, courses, or milestones.
            </p>
          </div>
        )}
      </div>
    )

    // Step 8 — Review & Export
    if (step === 8) return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Review & Export</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            {isSubmitted
              ? 'Your self-assessment has been submitted. Approve and export it to Google Drive as a formatted document.'
              : 'Review your self-assessment below. When ready, submit it to share with your manager, then export to Google Drive.'}
          </p>
        </div>

        {/* Summary */}
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 14 }}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div><div style={label}>Employee</div><div style={{ fontSize: 13, color: '#e5e7eb' }}>{profile.name || profile.email}</div></div>
            <div><div style={label}>Supervisor</div><div style={{ fontSize: 13, color: '#e5e7eb' }}>{manager?.name || manager?.email || '—'}</div></div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ ...sectionLabel, color: '#818cf8' }}>Part One — Competency Evaluation</div>
            {review.competencies.map((c, i) => (
              c.term ? (
                <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${COMP_CONFIG[i].accent}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>
                    {COMP_CONFIG[i].label} <span style={{ color: '#6b7280', fontWeight: 400 }}>({COMP_CONFIG[i].sublabel})</span> — {c.term}
                  </div>
                  {c.examples.filter(Boolean).map((ex, j) => (
                    <div key={j} style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{j + 1}. {ex}</div>
                  ))}
                </div>
              ) : (
                <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6, fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>
                  {COMP_CONFIG[i].label} — not filled
                </div>
              )
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ ...sectionLabel, color: '#10b981' }}>Part Two — Goals & Rating</div>
            {review.goals_objectives.filter(g => g.description).map((g, i) => (
              <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{i + 1}. {g.description}</div>
                {g.outcome && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Outcome: {g.outcome}</div>}
              </div>
            ))}
            {review.overall_rating ? (
              <div style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: '#fbbf24' }}>{'★'.repeat(review.overall_rating)}</span>
                {' '}<span style={{ color: '#e5e7eb', fontWeight: 600 }}>{review.overall_rating}/5 — {STAR_LABELS[review.overall_rating].label}</span>
              </div>
            ) : (
              <div style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>No rating selected</div>
            )}
          </div>

          <div>
            <div style={{ ...sectionLabel, color: '#f59e0b' }}>Part Three — Next Year&apos;s Goals</div>
            {review.next_year_goals.filter(g => g.goal).map((g, i) => (
              <div key={i} style={{ padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{i + 1}. {g.goal}</div>
                {g.objective && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{g.objective}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Submit / Export */}
        {!isSubmitted ? (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>Ready to submit?</div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Once submitted, your self-assessment will be shared with your manager and cannot be edited.
              You&apos;ll then be able to export it to Google Drive.
            </p>
            <button onClick={() => setSubmitConfirm(true)}
              style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Submit Self-Assessment
            </button>
          </div>
        ) : driveUrl ? (
          <div style={{ ...card, background: '#0d1a13', border: '1px solid #1a4a35', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700, color: '#34d399', fontSize: 15, marginBottom: 8 }}>Exported to Google Drive</div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
              Your self-assessment has been saved as a formatted Google Doc.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: '#1a4a35', color: '#34d399', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1px solid #2a6b4a' }}>
                <ExternalLink size={13} /> Open in Google Docs
              </a>
              <button onClick={sendToDrive} disabled={exporting}
                style={{ padding: '9px 16px', background: 'transparent', color: '#6b7280', borderRadius: 8, fontSize: 13, border: '1px solid #2a2d3a', cursor: 'pointer' }}>
                Re-export
              </button>
            </div>
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>Export to Google Drive</div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              A formatted Google Doc will be created in the Performance Reviews folder with your completed self-assessment.
            </p>
            {!approved ? (
              <button onClick={() => setApproved(true)}
                style={{ width: '100%', padding: '10px', background: '#13151f', color: '#e5e7eb', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ✓ Confirm accuracy and approve for export
              </button>
            ) : (
              <div>
                <div style={{ padding: '8px 14px', background: '#0d1a13', border: '1px solid #1a4a35', borderRadius: 8, color: '#34d399', fontSize: 12, marginBottom: 12 }}>
                  ✓ Approved — ready to export
                </div>
                {exportError && (
                  <div style={{ padding: '8px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#f87171', fontSize: 12, marginBottom: 12 }}>
                    {exportError}
                  </div>
                )}
                <button onClick={sendToDrive} disabled={exporting}
                  style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {exporting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating Google Doc…</> : <><Send size={14} /> Send to Google Drive</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )

    return null
  }

  const canNext = step < STEPS.length - 1
  const canBack = step > 0

  const filteredGlossary = COMPETENCY_TERMS.filter(t =>
    t.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    t.definition.toLowerCase().includes(glossarySearch.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#f0f2fa', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: collapsed ? 56 : 240, flexShrink: 0, background: '#0d0f1a', borderRight: '1px solid #1e2130', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden' }}>

        {/* Logo + collapse */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: collapsed ? '0 12px' : '0 16px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17 }}>⭐</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#f0f2fa', whiteSpace: 'nowrap' }}>Self-Assessment</span>
            </div>
          )}
          {collapsed && <span style={{ fontSize: 17 }}>⭐</span>}
          <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Step list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!collapsed && <div style={sectionLabel}>Steps</div>}
          {STEPS.map((s, i) => {
            const isActive = step === i
            const isDone = i < step || isStepComplete(i, review)
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => goTo(i)}
                title={collapsed ? s.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: collapsed ? '8px' : '7px 8px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, border: isActive ? '1px solid rgba(79,70,229,0.35)' : '1px solid transparent',
                  background: isActive ? '#1e1f3a' : 'transparent',
                  cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#13151f' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: isDone ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : isActive ? '#1e1f3a' : '#13151f',
                  border: isActive && !isDone ? '1.5px solid #4f46e5' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isDone
                    ? <CheckCircle2 size={13} color="#fff" />
                    : <Icon size={12} color={isActive ? '#818cf8' : '#4b5563'} />
                  }
                </div>
                {!collapsed && (
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    {s.part && <div style={{ fontSize: 9, color: '#374151', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.part}</div>}
                    <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#e0e7ff' : '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.label}
                    </div>
                  </div>
                )}
              </button>
            )
          })}

          {/* Divider */}
          <div style={{ margin: '8px 0', borderTop: '1px solid #1e2130' }} />
          {!collapsed && <div style={sectionLabel}>Resources</div>}

          {[
            { label: 'Employee Guide', icon: BookOpen, onClick: () => setShowGuide(true) },
            { label: 'Competency Glossary', icon: BookMarked, onClick: () => setShowGlossary(true) },
          ].map(({ label: l, icon: Icon, onClick }) => (
            <button key={l} onClick={onClick} title={collapsed ? l : undefined}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '7px 8px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', marginBottom: 2 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#13151f' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: '#13151f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={12} color="#6b7280" />
              </div>
              {!collapsed && <span style={{ fontSize: 12, color: '#9ca3af' }}>{l}</span>}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: collapsed ? '8px' : '8px 12px', borderTop: '1px solid #1e2130', flexShrink: 0 }}>
          {/* Status pill */}
          {!collapsed && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: isSubmitted ? '#0d2b1f' : '#13151f', border: `1px solid ${isSubmitted ? '#1a4a35' : '#1e2130'}`, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSubmitted ? '#34d399' : '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isSubmitted ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
                {isSubmitted ? 'Submitted' : 'Draft'}
              </span>
              {saving && !isSubmitted && <Loader2 size={10} color="#6b7280" style={{ marginLeft: 'auto', animation: 'spin 1s linear infinite' }} />}
              {saved && !isSubmitted && <CheckCircle2 size={10} color="#34d399" style={{ marginLeft: 'auto' }} />}
            </div>
          )}

          {/* Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '4px' : '4px 4px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                {(profile.name || profile.email).charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#c4c9d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.name || profile.email}
                </div>
                <div style={{ fontSize: 10, color: '#4b5563' }}>Employee</div>
              </div>
            )}
          </div>

          {/* Sign out */}
          <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }}
            title={collapsed ? 'Sign out' : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '7px' : '7px 8px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', marginTop: 4 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#13151f' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <LogOut size={13} color="#6b7280" />
            {!collapsed && <span style={{ fontSize: 12, color: '#6b7280' }}>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ height: 56, background: '#0d0f1a', borderBottom: '1px solid #1e2130', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentStep.part && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {currentStep.part} ·
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: '#c4c9d4' }}>{currentStep.label}</span>
            <span style={{ fontSize: 11, color: '#374151' }}>· Step {step + 1} of {STEPS.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isSubmitted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4b5563' }}>
                {saving ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : saved ? <><CheckCircle2 size={11} color="#34d399" /> Saved</> : 'Auto-saves'}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#1e2130', flexShrink: 0 }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', width: `${((step) / (STEPS.length - 1)) * 100}%`, transition: 'width 0.3s ease' }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {renderStepContent()}
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ height: 64, background: '#0d0f1a', borderTop: '1px solid #1e2130', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={back} disabled={!canBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'transparent', color: canBack ? '#9ca3af' : '#374151', border: `1px solid ${canBack ? '#2a2d3a' : '#1e2130'}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: canBack ? 'pointer' : 'default', transition: 'all 0.15s' }}>
            <ChevronLeft size={15} /> Back
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i === step ? '#6366f1' : i < step ? '#4f46e5' : '#1e2130',
                transition: 'all 0.2s', cursor: 'pointer',
              }} onClick={() => goTo(i)} />
            ))}
          </div>

          {canNext ? (
            <button onClick={next}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <div style={{ width: 90 }} />
          )}
        </div>
      </main>

      {/* ── Guide panel ── */}
      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowGuide(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#0d0f1a', borderLeft: '1px solid #1e2130', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={14} color="#818cf8" />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f2fa' }}>Employee Guide</span>
              </div>
              <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {[
                { title: 'Purpose', content: 'This self-assessment provides you an opportunity to reflect on your performance during the review period, set goals, and identify areas for development. It also prepares you for your evaluation discussion with your supervisor.' },
                { title: 'Preparation', content: 'Review your job description and past evaluations. Gather relevant documentation to support your evaluation of your performance.' },
                { title: 'Tips', content: 'Be honest with yourself. Use specific examples. Stay professional. Reflect on periodic feedback you\'ve received from management throughout the year.' },
                { title: 'Mistakes to Avoid', content: '• Avoid vague or general statements — be specific.\n• Don\'t shy away from discussing difficulties.\n• Don\'t ignore input from others — take feedback to heart.' },
              ].map(s => (
                <div key={s.title} style={{ marginBottom: 16, padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2130' }}>
                  <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.content}</div>
                </div>
              ))}

              <div style={{ marginBottom: 16, padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2130' }}>
                <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Star Rating Matrix</div>
                {[5, 4, 3, 2, 1].map(n => {
                  const colors: Record<number, string> = { 5: '#a78bfa', 4: '#34d399', 3: '#fbbf24', 2: '#fb923c', 1: '#f87171' }
                  return (
                    <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 14, color: colors[n], fontWeight: 800, minWidth: 20 }}>{n}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors[n] }}>{STAR_LABELS[n].label}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{STAR_LABELS[n].description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2130' }}>
                <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>SMART Goal Method</div>
                {[['S', 'Specific', 'Goals should be specific and narrow enough for effective planning.'], ['M', 'Measurable', 'Define how progress towards the goal will be made.'], ['A', 'Attainable', 'Ensure goals can be accomplished within a reasonable timeframe.'], ['R', 'Relevant', "Goals should align with Company values and your job description."], ['T', 'Time-Bound', 'Set a realistic date and stick to it.']].map(([l, w, d]) => (
                  <div key={l} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: '#818cf8', fontSize: 14, minWidth: 16 }}>{l}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#c4c9d4' }}>{w}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Glossary panel ── */}
      {showGlossary && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowGlossary(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#0d0f1a', borderLeft: '1px solid #1e2130', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookMarked size={14} color="#818cf8" />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f2fa' }}>Competency Glossary</span>
              </div>
              <button onClick={() => setShowGlossary(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
              <input value={glossarySearch} onChange={e => setGlossarySearch(e.target.value)}
                placeholder="Search competencies…"
                style={{ width: '100%', background: '#13151f', border: '1px solid #2a2d3a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e5e7eb', boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {filteredGlossary.map(t => (
                <div key={t.term} style={{ marginBottom: 10, padding: '12px 14px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2130' }}>
                  <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 13, marginBottom: 4 }}>{t.term}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>{t.definition}</div>
                </div>
              ))}
              {filteredGlossary.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#374151', fontSize: 13 }}>No results found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Submit modal ── */}
      {submitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: 32, maxWidth: 400, width: '90%' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 18, color: '#f0f2fa' }}>Submit Self-Assessment?</h2>
            <p style={{ margin: '0 0 24px', color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>
              Once submitted, your self-assessment will be shared with your manager and cannot be edited.
              Make sure you have reviewed all sections.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSubmitConfirm(false)}
                style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Go Back
              </button>
              <button onClick={submit} disabled={saving}
                style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
