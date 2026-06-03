'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Profile = { id: string; name: string | null; email: string; role: string; manager_id: string | null }
type Manager = { name: string | null; email: string } | null

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
  // legacy fields kept for compat
  strengths?: string
  growth_areas?: string
  overall_comments?: string
}

// ── Glossary ────────────────────────────────────────────────────────────────
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
  5: { label: 'Outstanding (5 ★)', description: 'Consistently exceeds performance requirements.', color: '#f59e0b' },
  4: { label: 'Exceeds Job Requirements (4 ★)', description: 'Meets and at times exceeds performance requirements (above average).', color: '#10b981' },
  3: { label: 'Meets Expectations (3 ★)', description: 'Job requirements are being met at a satisfactory level.', color: '#6366f1' },
  2: { label: 'Needs Improvement (2 ★)', description: 'Does not consistently meet the expected job requirements.', color: '#f97316' },
  1: { label: 'Unsatisfactory (1 ★)', description: 'Demonstrates an unacceptable level of skills and competencies.', color: '#ef4444' },
}

const COMPETENCY_CONFIG: { type: CompetencyType; label: string; color: string }[] = [
  { type: 'positive', label: 'Competency One — Positive', color: '#10b981' },
  { type: 'positive', label: 'Competency Two — Positive', color: '#10b981' },
  { type: 'constructive', label: 'Competency Three — Constructive', color: '#f97316' },
  { type: 'constructive', label: 'Competency Four — Constructive', color: '#f97316' },
  { type: 'choice', label: 'Competency Five — Your Choice', color: '#818cf8' },
]

function makeDefaultReview(): SelfReview {
  return {
    competencies: COMPETENCY_CONFIG.map(c => ({ type: c.type, term: '', examples: ['', '', ''] })),
    goals_objectives: [
      { description: '', outcome: '', reasoning: '' },
      { description: '', outcome: '', reasoning: '' },
      { description: '', outcome: '', reasoning: '' },
    ],
    next_year_goals: [
      { goal: '', objective: '' },
      { goal: '', objective: '' },
    ],
    overall_rating: null,
    status: 'draft',
  }
}

function mergeReview(saved: Partial<SelfReview> | null): SelfReview {
  const d = makeDefaultReview()
  if (!saved) return d
  return {
    ...d,
    ...saved,
    competencies: saved.competencies?.length ? saved.competencies : d.competencies,
    goals_objectives: saved.goals_objectives?.length ? saved.goals_objectives : d.goals_objectives,
    next_year_goals: saved.next_year_goals?.length ? saved.next_year_goals : d.next_year_goals,
  }
}

type Props = {
  profile: Profile
  manager: Manager
  initialSelfReview: Partial<SelfReview> | null
}

export default function EmployeePortal({ profile, manager, initialSelfReview }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'form' | 'guide' | 'glossary'>('form')
  const [review, setReview] = useState<SelfReview>(() => mergeReview(initialSelfReview))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [glossarySearch, setGlossarySearch] = useState('')

  const isSubmitted = review.status === 'submitted'

  const save = useCallback(async (status: 'draft' | 'submitted' = 'draft') => {
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
          status,
          // legacy compat
          strengths: '',
          growthAreas: '',
          goalReflections: [],
          overallComments: '',
        }),
      })
      if (status === 'submitted') {
        setReview(r => ({ ...r, status: 'submitted' }))
        router.refresh()
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }, [review, router])

  function updateCompetency(index: number, field: keyof Competency, value: string | string[]) {
    setReview(r => {
      const comps = [...r.competencies]
      comps[index] = { ...comps[index], [field]: value }
      return { ...r, competencies: comps }
    })
  }

  function updateExample(compIndex: number, exIndex: number, value: string) {
    setReview(r => {
      const comps = [...r.competencies]
      const examples = [...comps[compIndex].examples] as [string, string, string]
      examples[exIndex] = value
      comps[compIndex] = { ...comps[compIndex], examples }
      return { ...r, competencies: comps }
    })
  }

  function updateGoal(index: number, field: keyof GoalItem, value: string) {
    setReview(r => {
      const goals = [...r.goals_objectives]
      goals[index] = { ...goals[index], [field]: value }
      return { ...r, goals_objectives: goals }
    })
  }

  function updateNextYearGoal(index: number, field: keyof NextYearGoal, value: string) {
    setReview(r => {
      const goals = [...r.next_year_goals]
      goals[index] = { ...goals[index], [field]: value }
      return { ...r, next_year_goals: goals }
    })
  }

  function addGoal() {
    if (review.goals_objectives.length >= 5) return
    setReview(r => ({ ...r, goals_objectives: [...r.goals_objectives, { description: '', outcome: '', reasoning: '' }] }))
  }

  function addNextYearGoal() {
    if (review.next_year_goals.length >= 5) return
    setReview(r => ({ ...r, next_year_goals: [...r.next_year_goals, { goal: '', objective: '' }] }))
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight: '100vh', background: '#0b0d14', color: '#f0f2fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' } as React.CSSProperties,
    header: { background: '#0d0f1a', borderBottom: '1px solid #1e2130', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    card: { background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '24px 28px', marginBottom: 20 } as React.CSSProperties,
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 },
    input: { width: '100%', padding: '10px 14px', background: '#0d1117', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'inherit' },
    select: { width: '100%', padding: '10px 14px', background: '#0d1117', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const },
    tab: (active: boolean): React.CSSProperties => ({
      padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, borderRadius: 8,
      background: active ? '#1e2130' : 'transparent', color: active ? '#f0f2fa' : '#6b7280',
    }),
    sectionTitle: { fontSize: 18, fontWeight: 700, color: '#f0f2fa', marginBottom: 4 } as React.CSSProperties,
    badge: (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + '20', color }),
  }

  const filteredGlossary = COMPETENCY_TERMS.filter(t =>
    t.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    t.definition.toLowerCase().includes(glossarySearch.toLowerCase())
  )

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>⭐</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#f0f2fa' }}>Performance Review</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{profile.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSubmitted && <span style={S.badge('#34d399')}>✓ Submitted</span>}
          <button onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }}
            style={{ padding: '5px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#0d0f1a', borderBottom: '1px solid #1e2130', padding: '0 32px', display: 'flex', gap: 4 }}>
        <button style={S.tab(activeTab === 'form')} onClick={() => setActiveTab('form')}>📝 Self-Assessment</button>
        <button style={S.tab(activeTab === 'guide')} onClick={() => setActiveTab('guide')}>📖 Employee Guide</button>
        <button style={S.tab(activeTab === 'glossary')} onClick={() => setActiveTab('glossary')}>📚 Competency Glossary</button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── GUIDE TAB ────────────────────────────────────────────────── */}
        {activeTab === 'guide' && (
          <div>
            <h1 style={{ ...S.sectionTitle, fontSize: 22, marginBottom: 20 }}>Employee Guide to Self-Assessments</h1>

            <div style={S.card}>
              <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.7, marginBottom: 0 }}>
                The purpose of this self-assessment provides you an opportunity to reflect on your performance during the relevant review period, set goals, and identify areas for development. It will also help prepare you for the evaluation discussion with your supervisor.
              </div>
            </div>

            {[
              { title: 'Preparation', content: 'Prepare your self-assessment by reviewing your job description, past evaluations, and gathering relevant documentation to give a reason for your evaluation of your performance.' },
              { title: 'Components of a Self-Assessment', content: 'The self-assessment components will include a 5-Word Competency assessment, goal/objective successful or unsuccessful completion, and accomplishments. Make sure you indicate any challenges you faced that you may (or may not) have overcome and training or development needs.' },
              { title: 'Tips', content: 'As you reflect on your performance, make sure you are honest with yourself, use specific examples, stay professional, and reflect on any periodic feedback you have received from management throughout the year.' },
            ].map(s => (
              <div key={s.title} style={S.card}>
                <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.7 }}>{s.content}</div>
              </div>
            ))}

            <div style={S.card}>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mistakes to Avoid</div>
              {[
                'Avoid generalized or vague statements. Make sure you are specific about your accomplishments and areas for growth.',
                "Don't disregard or shy away from discussing difficulties; they are part of your growth journey.",
                "Don't ignore input from others and limit your self-awareness. Take feedback, positive and constructive criticism, to heart and apply it to your professional growth.",
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 14, color: '#9ca3af', lineHeight: 1.6 }}>
                  <span style={{ color: '#f87171', flexShrink: 0 }}>✗</span>
                  {m}
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 700, color: '#f0f2fa', marginBottom: 16, fontSize: 15 }}>Rush Media Performance Review — Star Matrix</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[5, 4, 3, 2, 1].map(n => {
                  const s = STAR_LABELS[n]
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', background: '#0d1117', borderRadius: 8, border: `1px solid ${s.color}30` }}>
                      <div style={{ fontSize: 22, color: s.color, fontWeight: 800, minWidth: 28 }}>{n}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: s.color, fontSize: 13 }}>{s.label}</div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{s.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 700, color: '#f0f2fa', marginBottom: 16, fontSize: 15 }}>SMART Goal Method</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { letter: 'S', word: 'Specific', desc: 'Goals and/or objectives should be specific and narrow enough for effective planning and attainability.' },
                  { letter: 'M', word: 'Measurable', desc: 'Define how progress towards the goal will be made.' },
                  { letter: 'A', word: 'Attainable', desc: 'Ensure that goals are accomplished reasonably within a certain timeframe.' },
                  { letter: 'R', word: 'Relevant', desc: "Goals should align with Company values and employees' job descriptions." },
                  { letter: 'T', word: 'Time-Bound', desc: 'Set a realistic date and stick to it.' },
                ].map(s => (
                  <div key={s.letter} style={{ display: 'flex', gap: 14, padding: '10px 14px', background: '#0d1117', borderRadius: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#818cf8', minWidth: 24 }}>{s.letter}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#c4c9d4', fontSize: 13 }}>{s.word}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 700, color: '#f0f2fa', marginBottom: 16, fontSize: 15 }}>Goals vs. Objectives vs. Accomplishments</div>
              {[
                { title: 'Goal', color: '#818cf8', desc: 'Broad, longer-term, achievable outcomes. Determined and agreed upon by the employee and manager as a plan of action for the following review cycle.', example: 'Improve public speaking skills.' },
                { title: 'Objective', color: '#34d399', desc: 'Shorter, more specific, measurable steps or actions toward achieving a goal. Generally determined by the employee, with manager support, on how they anticipate reaching the goal.', example: 'Attend a public speaking course and/or practice delivering a presentation to a colleague one time per quarter.' },
                { title: 'Accomplishment', color: '#f59e0b', desc: 'Tangible achievements or milestones as a result of pursuing goals and objectives. What has been successfully met regardless of whether the result was part of the goal-planning process.', example: 'Successfully delivered a confident presentation at a Company-wide meeting where suggestions were put into practice.' },
              ].map(i => (
                <div key={i.title} style={{ marginBottom: 16, padding: '14px 16px', background: '#0d1117', borderRadius: 8, borderLeft: `3px solid ${i.color}` }}>
                  <div style={{ fontWeight: 700, color: i.color, fontSize: 13, marginBottom: 4 }}>{i.title}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, marginBottom: 8 }}>{i.desc}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Example: {i.example}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 700, color: '#f0f2fa', marginBottom: 12, fontSize: 15 }}>Questions to Ask Yourself</div>
              {[
                'How do you perform on the team and in comparison to your colleagues?',
                'Does your performance limit the success of your colleagues or does it help them?',
                'Are you transparent with yourself about your performance?',
                'Are you efficient?',
                'What is one small thing you would change that you feel would have the biggest impact to your performance?',
                'How would you describe your work ethic in one word?',
                'Where have you made the most progress?',
                'What makes you most proud?',
                'Where have you had the most impact on others and what word best describes that impact?',
              ].map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #1e2130', fontSize: 14, color: '#9ca3af' }}>
                  <span style={{ color: '#818cf8', fontSize: 12, marginTop: 2 }}>▸</span> {q}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GLOSSARY TAB ─────────────────────────────────────────────── */}
        {activeTab === 'glossary' && (
          <div>
            <h1 style={{ ...S.sectionTitle, fontSize: 22, marginBottom: 8 }}>Competency Glossary of Terms</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              Use these definitions when selecting competencies in your self-assessment. Select terms that best reflect your performance during the review period.
            </p>
            <input
              value={glossarySearch}
              onChange={e => setGlossarySearch(e.target.value)}
              placeholder="Search competencies…"
              style={{ ...S.input, marginBottom: 16, resize: 'none' }}
            />
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredGlossary.map(t => (
                <div key={t.term} style={{ ...S.card, marginBottom: 0, padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 14, marginBottom: 4 }}>{t.term}</div>
                  <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.6 }}>{t.definition}</div>
                </div>
              ))}
              {filteredGlossary.length === 0 && (
                <div style={{ color: '#374151', textAlign: 'center', padding: 40, fontSize: 14 }}>No matching competencies found.</div>
              )}
            </div>
          </div>
        )}

        {/* ── SELF-ASSESSMENT FORM ──────────────────────────────────────── */}
        {activeTab === 'form' && (
          <div>
            {/* Employee info */}
            <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={S.label}>Employee Name</div>
                <div style={{ fontSize: 15, color: '#e5e7eb' }}>{profile.name || profile.email}</div>
              </div>
              <div>
                <div style={S.label}>Supervisor</div>
                <div style={{ fontSize: 15, color: '#e5e7eb' }}>{manager?.name || manager?.email || <span style={{ color: '#374151' }}>Not assigned</span>}</div>
              </div>
            </div>

            {isSubmitted && (
              <div style={{ background: '#0d2b1f', border: '1px solid #1a4a35', borderRadius: 10, padding: '14px 20px', marginBottom: 20, fontSize: 14, color: '#34d399' }}>
                ✓ Your self-assessment was submitted on {review.submitted_at ? new Date(review.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'record'}.
                It has been shared with your manager.
              </div>
            )}

            {/* ── PART ONE ── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ background: '#818cf8', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>PART ONE</div>
                <div style={S.sectionTitle}>Competency Evaluation</div>
              </div>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Consider what is working about your performance and where improvements can be made. Select a competency from the glossary for each section and provide 1–3 specific examples.{' '}
                <button onClick={() => setActiveTab('glossary')} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                  View Glossary →
                </button>
              </p>
            </div>

            {COMPETENCY_CONFIG.map((config, i) => (
              <div key={i} style={{ ...S.card, borderLeft: `3px solid ${config.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={S.badge(config.color)}>{config.type === 'positive' ? 'Positive' : config.type === 'constructive' ? 'Constructive' : 'Your Choice'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e5e7eb' }}>{config.label}</span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Competency Term</label>
                  <select value={review.competencies[i]?.term || ''} onChange={e => updateCompetency(i, 'term', e.target.value)}
                    disabled={isSubmitted} style={S.select}>
                    <option value="">— Select from glossary —</option>
                    {COMPETENCY_TERMS.map(t => <option key={t.term} value={t.term}>{t.term}</option>)}
                  </select>
                  {review.competencies[i]?.term && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic', padding: '8px 12px', background: '#0d1117', borderRadius: 6 }}>
                      {COMPETENCY_TERMS.find(t => t.term === review.competencies[i].term)?.definition}
                    </div>
                  )}
                </div>
                <div>
                  <label style={S.label}>Examples (1–3)</label>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: config.color, fontSize: 13, marginTop: 10, minWidth: 16 }}>{j + 1}.</span>
                      <textarea
                        value={review.competencies[i]?.examples[j] || ''}
                        onChange={e => updateExample(i, j, e.target.value)}
                        disabled={isSubmitted}
                        placeholder={j === 0 ? 'Required — provide a specific example' : 'Optional — add another example'}
                        rows={2}
                        style={{ ...S.input, flex: 1, opacity: j > 0 && !review.competencies[i]?.examples[j - 1] ? 0.4 : 1 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* ── PART TWO ── */}
            <div style={{ marginTop: 32, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ background: '#34d399', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>PART TWO</div>
                <div style={S.sectionTitle}>Goals, Objectives & Accomplishments</div>
              </div>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Indicate your progress and the successful or unsuccessful completion of your goals or objectives, and explain why. List accomplishments made, either within your goal roadmap or as stand-alone achievements.{' '}
                <button onClick={() => setActiveTab('guide')} style={{ color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                  View Guide →
                </button>
              </p>
            </div>

            {review.goals_objectives.map((goal, i) => (
              <div key={i} style={{ ...S.card, borderLeft: '3px solid #34d399' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#34d399', marginBottom: 14 }}>Goal / Objective / Accomplishment {i + 1}</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Description</label>
                  <textarea value={goal.description} onChange={e => updateGoal(i, 'description', e.target.value)}
                    disabled={isSubmitted} rows={2} placeholder="Describe your goal, objective, or accomplishment…" style={S.input} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div>
                    <label style={S.label}>Outcome</label>
                    <select value={goal.outcome} onChange={e => updateGoal(i, 'outcome', e.target.value)}
                      disabled={isSubmitted} style={S.select}>
                      <option value="">— Select —</option>
                      <option value="successful">✓ Successful</option>
                      <option value="unsuccessful">✗ Unsuccessful</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Reason / Explanation</label>
                    <input value={goal.reasoning} onChange={e => updateGoal(i, 'reasoning', e.target.value)}
                      disabled={isSubmitted} placeholder="Why was it successful or unsuccessful?" style={S.input} />
                  </div>
                </div>
              </div>
            ))}
            {!isSubmitted && review.goals_objectives.length < 5 && (
              <button onClick={addGoal} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#34d399', border: '1px dashed #1a4a35', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
                + Add Another Goal / Objective / Accomplishment
              </button>
            )}

            {/* Overall Rating */}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#f0f2fa', marginBottom: 4 }}>Overall Performance Rating</div>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Select the rating that best reflects your overall performance for this review period.</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[5, 4, 3, 2, 1].map(n => {
                  const s = STAR_LABELS[n]
                  const selected = review.overall_rating === n
                  return (
                    <button key={n} onClick={() => !isSubmitted && setReview(r => ({ ...r, overall_rating: n }))}
                      disabled={isSubmitted}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 8, border: `1.5px solid ${selected ? s.color : '#2a2d3e'}`, background: selected ? s.color + '15' : '#0d1117', cursor: isSubmitted ? 'default' : 'pointer', textAlign: 'left', width: '100%' }}>
                      <div style={{ fontSize: 20, color: s.color, fontWeight: 800, minWidth: 28 }}>{'★'.repeat(n)}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: selected ? s.color : '#9ca3af', fontSize: 13 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── PART THREE ── */}
            <div style={{ marginTop: 32, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ background: '#f59e0b', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>PART THREE</div>
                <div style={S.sectionTitle}>Next Year&apos;s Goals & Objectives</div>
              </div>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Identify at least two goals you anticipate or want to complete over the next review period. Discuss roadmaps (objectives) on how you plan to reach those goals. These will be reviewed with your manager and may change based on your discussion.
              </p>
            </div>

            {review.next_year_goals.map((g, i) => (
              <div key={i} style={{ ...S.card, borderLeft: '3px solid #f59e0b' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b', marginBottom: 14 }}>Goal {i + 1}</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Goal</label>
                  <input value={g.goal} onChange={e => updateNextYearGoal(i, 'goal', e.target.value)}
                    disabled={isSubmitted} placeholder="e.g. Improve public speaking skills" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Objective / Roadmap</label>
                  <textarea value={g.objective} onChange={e => updateNextYearGoal(i, 'objective', e.target.value)}
                    disabled={isSubmitted} rows={2} placeholder="e.g. Attend a public speaking course and practice quarterly presentations" style={S.input} />
                </div>
              </div>
            ))}
            {!isSubmitted && review.next_year_goals.length < 5 && (
              <button onClick={addNextYearGoal} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#f59e0b', border: '1px dashed #92400e', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 20 }}>
                + Add Another Goal
              </button>
            )}

            {/* Actions */}
            {!isSubmitted && (
              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button onClick={() => save('draft')} disabled={saving}
                  style={{ flex: 1, padding: '12px', background: '#1e2130', color: saved ? '#34d399' : '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Draft'}
                </button>
                <button onClick={() => setSubmitConfirm(true)}
                  style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Submit Self-Assessment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit confirmation modal */}
      {submitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: 36, maxWidth: 420, width: '90%' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, color: '#f0f2fa' }}>Submit Self-Assessment?</h2>
            <p style={{ margin: '0 0 24px', color: '#9ca3af', fontSize: 14, lineHeight: 1.6 }}>
              Once submitted, your self-assessment will be shared with your manager and cannot be edited. Make sure you have reviewed all sections before submitting.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSubmitConfirm(false)}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Go Back
              </button>
              <button onClick={() => { setSubmitConfirm(false); save('submitted') }} disabled={saving}
                style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
