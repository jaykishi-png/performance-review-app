'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Loader2, Star, History, X, Clock, RefreshCw } from 'lucide-react'

// ─── Competency glossary ──────────────────────────────────────────────────────

const COMPETENCIES: { name: string; definition: string }[] = [
  { name: 'Accountability and Dependability', definition: 'Takes personal responsibility for the quality and timeliness of work; achieves qualitative results with little oversight.' },
  { name: 'Adaptability and Flexibility', definition: 'Adapts to changing business needs, conditions, and work responsibilities; works with a variety of situations, individuals, groups, and varying types of work.' },
  { name: 'Analysis/Reasoning', definition: 'Examines data to comprehend and grasp issues, draw conclusions, and solve problems.' },
  { name: 'Attention to Detail', definition: 'Diligently attends to details and pursues quality in accomplishing tasks.' },
  { name: 'Business Alignment', definition: 'Work performed and produced aligns with the direction, products, services, and performance of the business with the rest of the organizational objectives.' },
  { name: 'Coaching and Mentoring', definition: 'Enables colleagues to grow and succeed through feedback, instruction, and encouragement.' },
  { name: 'Communication', definition: 'Listens to others and communicates in an effective manner.' },
  { name: 'Confidence', definition: 'Matured and justified self-belief in one\'s ability to do the job in a successful and productive manner.' },
  { name: 'Creative and Innovative Thinking', definition: 'Develops fresh ideas that provide solutions to all types of workplace challenges.' },
  { name: 'Customer Focused', definition: 'Builds and maintains customer satisfaction with the products offered by the organization and provides excellent customer service to internal and external customers.' },
  { name: 'Decision Making and Judgement', definition: 'Makes timely, informed decisions that take into account the facts, goals, constraints, and risks.' },
  { name: 'Developing Others', definition: 'Willingness to delegate responsibility when applicable, work with others, and coach to develop others\' capabilities.' },
  { name: 'Development and Continuous Learning', definition: 'Displays an ongoing commitment to learning and self-improvement; has the desire and makes the effort to acquire new knowledge or skills for work.' },
  { name: 'Empowering Others', definition: 'Conveying confidence in employees\' ability to be successful and autonomous, especially with new and challenging tasks; allowing employees the freedom to do their job independently.' },
  { name: 'Ethics and Integrity', definition: 'Earns others\' trust and respect through consistent honesty and professionalism in all interactions.' },
  { name: 'Flexibility', definition: 'Adapting to and working with a variety of situations, individuals, and groups. Openness to different and new ways of doing things; willingness to modify one\'s preferred way of doing things.' },
  { name: 'Group Facilitation', definition: 'Enables and encourages cooperative and productive group interactions.' },
  { name: 'Influencing Others', definition: 'Influences others to be excited and committed to furthering the organization objectives; ability to gain others\' support for ideas, proposals, and solutions.' },
  { name: 'Initiative', definition: 'Recognizes situations that warrant initiative and moves forward without hesitation; reasonably resolves issues, problems, or situations.' },
  { name: 'Interpersonal Skills', definition: 'Gets along and interacts positively with colleagues and others; understands and relates to others.' },
  { name: 'Leadership', definition: 'Promotes organizational mission and goals, and shows ways to achieve them.' },
  { name: 'Listening', definition: 'Comprehends, understands, and learns from what others say.' },
  { name: 'Planning and Organizing', definition: 'Defining tasks and milestones to achieve objectives while ensuring the optimal use of resources to achieve those objectives.' },
  { name: 'Policy, Rules, and Regulation Enforcement', definition: 'Enforces policies, rules, and regulations consistently and in a way that is and is perceived as fair, objective, and reasonable.' },
  { name: 'Problem-Solving', definition: 'Resolves difficult or complicated challenges.' },
  { name: 'Project Management', definition: 'Structures and directs others\' work on projects or programs; ensures timeliness of project completion and meets project objectives and deadlines.' },
  { name: 'Reading Comprehension', definition: 'Grasps the meaning of written information and applies it to work situations.' },
  { name: 'Relationship Building', definition: 'Builds constructive working relationships characterized by a high level of acceptance, cooperation, and mutual respect.' },
  { name: 'Researching Information', definition: 'Identifies, collects, and organizes data for analyzing and decision-making.' },
  { name: 'Results Focused', definition: 'Focuses on results and desired outcomes and how best to achieve them in order to get the job done.' },
  { name: 'Risk Management', definition: 'Identifying, assessing, and managing risk while striving to attain objectives.' },
  { name: 'Speaking', definition: 'Conveys ideas and facts orally pertinent and relevant to the audience and in a way the audience can understand.' },
  { name: 'Staff Management', definition: 'Manages staff in ways that improve their ability to succeed on the job in an autonomous manner.' },
  { name: 'Strategic Vision', definition: 'Sees the big, long-range picture.' },
  { name: 'Stress Tolerance', definition: 'Maintains composure in highly stressful or adverse situations.' },
  { name: 'Tact', definition: 'Diplomatically handles challenges or tense interpersonal situations.' },
  { name: 'Teamwork', definition: 'Promotes cooperation and commitment within a team to achieve goals and deliverables.' },
  { name: 'Training and Presenting Information', definition: 'Formally, effectively, and thoughtfully delivers information to a group.' },
  { name: 'Writing', definition: 'Conveys ideas and facts in writing using language the reader and audience will best understand.' },
]

const SCORE_LABELS: Record<number, { label: string; description: string; color: string }> = {
  1: { label: 'Unsatisfactory', description: 'Demonstrates an unacceptable level of skills and competencies.', color: 'text-red-400' },
  2: { label: 'Needs Improvement', description: 'Does not consistently meet the expected job requirements.', color: 'text-orange-400' },
  3: { label: 'Meets Expectations', description: 'Job requirements are being met at a satisfactory level.', color: 'text-yellow-400' },
  4: { label: 'Exceeds Job Requirements', description: 'Meets and at times exceeds performance requirements (above average).', color: 'text-emerald-400' },
  5: { label: 'Outstanding', description: 'Consistently exceeds performance requirements.', color: 'text-purple-400' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompetencyEntry {
  competency: string
  examples: [string, string, string]
}

interface GoalEntry {
  text: string
  status: 'successful' | 'unsuccessful' | 'ongoing' | ''
  explanation: string
}

interface NextGoal {
  text: string
  targetDate: string
}

interface FormData {
  // Part 0 — Header
  employeeName: string
  employeePosition: string
  employeeDivision: string
  supervisorName: string
  appraisalPeriod: string
  reviewDate: string
  // Part 1 — Competencies
  competencyOne: CompetencyEntry      // positive
  competencyTwo: CompetencyEntry      // positive
  competencyThree: CompetencyEntry    // constructive
  competencyFour: CompetencyEntry     // constructive
  competencyFive: CompetencyEntry     // positive or constructive
  competencyFiveType: 'positive' | 'constructive'
  // Part 2 — Goals
  goals: GoalEntry[]
  overallScore: number
  overallSummary: string
  // Part 3 — Next year
  nextGoals: NextGoal[]
}

const emptyCompetency = (): CompetencyEntry => ({ competency: '', examples: ['', '', ''] })
const emptyGoal = (): GoalEntry => ({ text: '', status: '', explanation: '' })
const emptyNextGoal = (): NextGoal => ({ text: '', targetDate: '' })

const defaultForm = (): FormData => ({
  employeeName: '',
  employeePosition: '',
  employeeDivision: '',
  supervisorName: '',
  appraisalPeriod: '',
  reviewDate: '',
  competencyOne: emptyCompetency(),
  competencyTwo: emptyCompetency(),
  competencyThree: emptyCompetency(),
  competencyFour: emptyCompetency(),
  competencyFive: emptyCompetency(),
  competencyFiveType: 'positive',
  goals: [emptyGoal(), emptyGoal(), emptyGoal()],
  overallScore: 0,
  overallSummary: '',
  nextGoals: [emptyNextGoal(), emptyNextGoal(), emptyNextGoal()],
})

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'info',      label: 'Employee Info',     part: null },
  { id: 'comp1',     label: 'Competency 1',       part: 'PART ONE' },
  { id: 'comp2',     label: 'Competency 2',       part: 'PART ONE' },
  { id: 'comp3',     label: 'Competency 3',       part: 'PART ONE' },
  { id: 'comp4',     label: 'Competency 4',       part: 'PART ONE' },
  { id: 'comp5',     label: 'Competency 5',       part: 'PART ONE' },
  { id: 'goals',     label: 'Goals & Score',      part: 'PART TWO' },
  { id: 'nextgoals', label: "Next Year's Goals",  part: 'PART THREE' },
  { id: 'output',    label: 'Review Output',      part: null },
]

// ─── Save / load ─────────────────────────────────────────────────────────────

interface SavedReview {
  id: string
  employeeName: string
  employeePosition: string
  step: number      // current position (restored on resume)
  maxStep: number   // furthest step ever reached (shown in history)
  savedAt: string   // ISO timestamp
  form: FormData
}

/** Returns true if a step's required fields are filled — independent of current position. */
function isStepComplete(stepIndex: number, form: FormData): boolean {
  switch (stepIndex) {
    case 0: return !!(form.employeeName.trim() && form.supervisorName.trim())
    case 1: return !!(form.competencyOne.competency && form.competencyOne.examples[0].trim())
    case 2: return !!(form.competencyTwo.competency && form.competencyTwo.examples[0].trim())
    case 3: return !!(form.competencyThree.competency && form.competencyThree.examples[0].trim())
    case 4: return !!(form.competencyFour.competency && form.competencyFour.examples[0].trim())
    case 5: return !!(form.competencyFive.competency && form.competencyFive.examples[0].trim())
    case 6: return !!(form.goals.some(g => g.text.trim()) && form.overallScore > 0)
    case 7: return form.nextGoals.some(g => g.text.trim())
    default: return false
  }
}

const SAVES_KEY = 'manager-perf-review-saves'

function getSaves(): SavedReview[] {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY) ?? '[]') }
  catch { return [] }
}

function upsertSave(review: SavedReview): void {
  const saves = getSaves()
  const idx = saves.findIndex(s => s.id === review.id)
  if (idx >= 0) saves[idx] = review
  else saves.unshift(review)
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves.slice(0, 20)))
}

function deleteSave(id: string): void {
  localStorage.setItem(SAVES_KEY, JSON.stringify(getSaves().filter(s => s.id !== id)))
}

/**
 * Given the current appraisal period, returns the NEXT period.
 * "2025 - 2026"          → "2026 - 2027"
 * "May 2025 – May 2026"  → "May 2026 – May 2027"
 * Falls back to empty string if the period can't be parsed.
 */
function computeNextAppraisalPeriod(appraisalPeriod: string): string {
  if (!appraisalPeriod.trim()) return ''

  const parts = appraisalPeriod.split(/\s*[–—]\s*|\s*-\s*/)
  if (parts.length < 2) return ''

  const endPart  = parts[parts.length - 1].trim()   // e.g. "May 2026" or "2026"
  const yearMatch = endPart.match(/(\d{4})/)
  if (!yearMatch) return ''

  const endYear  = parseInt(yearMatch[1])
  const nextYear = endYear + 1

  // Pure-year format: "2025 - 2026" → "2026 - 2027"
  if (/^\d{4}$/.test(endPart)) {
    const startYear = parseInt(parts[0].trim())
    const gap = endYear - startYear
    return `${endYear} - ${endYear + gap}`
  }

  // Month-year format: "May 2025 – May 2026" → "May 2026 – May 2027"
  const nextEnd = endPart.replace(/\d{4}/, String(nextYear))
  return `${endPart} – ${nextEnd}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  saves,
  currentId,
  onLoad,
  onDelete,
  onClose,
}: {
  saves: SavedReview[]
  currentId: string
  onLoad: (s: SavedReview) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-[#0b0d14] border-l border-[#1e2030] flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2030] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
              <History size={14} className="text-purple-400" /> Saved Reviews
            </h2>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {saves.length === 0 ? 'No saves yet' : `${saves.length} review${saves.length !== 1 ? 's' : ''} · auto-saved to this browser`}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#1e2030] transition-all">
            <X size={15} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2
          [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-[#2a2d3a] [&::-webkit-scrollbar-thumb]:rounded-full">

          {saves.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm text-gray-500">No saved reviews yet</p>
              <p className="text-[11px] text-gray-700 mt-1.5 max-w-[200px] mx-auto leading-relaxed">
                Reviews auto-save once you enter the employee&apos;s name
              </p>
            </div>
          )}

          {saves.map(s => {
            const isCurrent   = s.id === currentId
            // Count steps 0–7 that actually have user content
            const CONTENT_STEPS = STEPS.length - 1 // 8 fillable steps (excludes Review Output)
            const filledCount = Array.from({ length: CONTENT_STEPS }, (_, i) => i)
              .filter(i => isStepComplete(i, s.form)).length
            const progress = Math.round((filledCount / CONTENT_STEPS) * 100)

            return (
              <div
                key={s.id}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  isCurrent
                    ? 'border-purple-700/50 bg-purple-900/10'
                    : 'border-[#1e2030] bg-[#0d0f1a]'
                }`}
              >
                {/* Name + meta */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-200 leading-snug">
                      {s.employeeName || 'Untitled Review'}
                      {isCurrent && (
                        <span className="ml-2 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 uppercase tracking-wider">
                          current
                        </span>
                      )}
                    </p>
                  </div>
                  {s.employeePosition && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{s.employeePosition}</p>
                  )}
                  {s.form.appraisalPeriod && (
                    <p className="text-[11px] text-purple-400/70 mt-0.5">📅 {s.form.appraisalPeriod}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Clock size={10} className="text-gray-700" />
                    <span className="text-[10px] text-gray-600">{relativeTime(s.savedAt)}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-[10px] text-gray-600">{filledCount} / {CONTENT_STEPS} steps filled</span>
                  </div>
                </div>

                {/* Progress bar — based on actual filled steps */}
                <div className="h-1 bg-[#1e2030] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${filledCount === CONTENT_STEPS ? 'bg-emerald-600' : 'bg-purple-700'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Actions */}
                {confirmDelete === s.id ? (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[11px] text-red-400">Delete this save?</p>
                    <button
                      onClick={() => { onDelete(s.id); setConfirmDelete(null) }}
                      className="px-2.5 py-1 rounded-lg bg-red-900/40 text-red-400 text-[11px] font-medium hover:bg-red-900/60 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1 rounded-lg border border-[#2a2d3a] text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {!isCurrent && (
                      <button
                        onClick={() => onLoad(s)}
                        className="flex-1 py-1.5 rounded-lg bg-purple-800/70 hover:bg-purple-700 text-white text-[11px] font-medium transition-colors"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(s.id)}
                      className={`${isCurrent ? 'flex-1' : ''} px-3 py-1.5 rounded-lg border border-[#2a2d3a] text-[11px] text-gray-600 hover:text-red-400 hover:border-red-800/50 transition-colors`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-[#1e2030]">
          <p className="text-[10px] text-gray-700 text-center leading-relaxed">
            Saved locally to this browser · cleared if browser data is wiped
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{children}</label>
}

function Input({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#0d0f1a] border border-[#1e2030] rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-700/60 transition-colors ${className}`}
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-[#0d0f1a] border border-[#1e2030] rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-700/60 transition-colors resize-none"
    />
  )
}

function CompetencySelect({ value, onChange, exclude = [] }: {
  value: string; onChange: (v: string) => void; exclude?: string[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#0d0f1a] border border-[#1e2030] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-700/60 transition-colors appearance-none"
    >
      <option value="">— Select a competency —</option>
      {COMPETENCIES.filter(c => !exclude.includes(c.name) || c.name === value).map(c => (
        <option key={c.name} value={c.name}>{c.name}</option>
      ))}
    </select>
  )
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2d3a] bg-[#0d0f1a] text-gray-400 hover:text-white hover:border-purple-700/60 transition-all"
    >
      {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ─── AI Draft helper ──────────────────────────────────────────────────────────

async function aiDraftSingleExample(
  competency: string,
  type: 'positive' | 'constructive',
  employeeName: string,
  role: string,
  context: string,
  exampleIndex: 0 | 1 | 2,
): Promise<string> {
  const res = await fetch('/api/performance-review/draft-example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competency, type, employeeName, role, context, exampleIndex }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Request failed (${res.status})`)
  }
  const data = await res.json() as { example?: string; error?: string }
  if (data.error) throw new Error(data.error)
  return data.example ?? ''
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepInfo({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Employee Information</h2>
        <p className="text-[12px] text-gray-500">Basic details for the review header.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Employee Name</Label>
          <Input value={form.employeeName} onChange={v => update({ employeeName: v })} placeholder="Full name" />
        </div>
        <div>
          <Label>Employee Position / Title</Label>
          <Input value={form.employeePosition} onChange={v => update({ employeePosition: v })} placeholder="e.g. Video Editor" />
        </div>
        <div>
          <Label>Employee Division</Label>
          <Input value={form.employeeDivision} onChange={v => update({ employeeDivision: v })} placeholder="e.g. Creative Production" />
        </div>
        <div>
          <Label>Supervisor Name (You)</Label>
          <Input value={form.supervisorName} onChange={v => update({ supervisorName: v })} placeholder="Your full name" />
        </div>
        <div>
          <Label>Appraisal Period</Label>
          <Input value={form.appraisalPeriod} onChange={v => update({ appraisalPeriod: v })} placeholder="e.g. May 2025 – May 2026" />
        </div>
        <div>
          <Label>Review Date</Label>
          <Input value={form.reviewDate} onChange={v => update({ reviewDate: v })} placeholder="e.g. May 28, 2026" />
        </div>
      </div>
    </div>
  )
}

// ─── Per-example AI row ───────────────────────────────────────────────────────

function ExampleRow({
  index,
  value,
  onChange,
  competency,
  effectiveType,
  employeeName,
  employeePosition,
}: {
  index: 0 | 1 | 2
  value: string
  onChange: (v: string) => void
  competency: string
  effectiveType: 'positive' | 'constructive'
  employeeName: string
  employeePosition: string
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDraft() {
    if (!competency || !context.trim()) return
    setLoading(true)
    setError('')
    try {
      const example = await aiDraftSingleExample(
        competency, effectiveType, employeeName, employeePosition, context, index
      )
      if (example) {
        onChange(example)
        setShowPrompt(false)
        setContext('')
      } else {
        setError('No example returned — try again.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const placeholder = index === 0
    ? 'e.g. "always delivers edits on time, strong ownership of projects"'
    : index === 1
    ? 'e.g. "took lead on the Q4 campaign without being asked"'
    : 'e.g. "mentored the junior editor on pacing and cuts"'

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 text-[12px] text-gray-600 pt-2.5 w-4">{index + 1}.</span>
        <div className="flex-1 space-y-1">
          <TextArea
            value={value}
            onChange={onChange}
            placeholder={index === 0 ? 'Required — describe a specific observable behavior' : 'Optional'}
            rows={2}
          />
          <div className="flex items-center justify-between">
            {error && <p className="text-[10px] text-red-400">{error}</p>}
            <div className="ml-auto">
              <button
                onClick={() => { setShowPrompt(v => !v); setError('') }}
                disabled={!competency}
                className="flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={10} />
                {showPrompt ? 'Cancel' : 'AI Draft'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPrompt && (
        <div className="ml-6 p-3 rounded-xl border border-purple-800/40 bg-purple-900/10 space-y-2">
          <p className="text-[11px] text-purple-300/80">
            Describe what happened — Claude will write the example.
          </p>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleDraft() }}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-[#0a0c14] border border-purple-800/40 rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-600/60 transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleDraft}
              disabled={loading || !context.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-800/80 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium transition-colors"
            >
              {loading
                ? <><Loader2 size={11} className="animate-spin" /> Drafting…</>
                : <><Sparkles size={11} /> Draft Example {index + 1}</>}
            </button>
            <span className="text-[10px] text-gray-700">⌘↵ to submit</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Competency step ──────────────────────────────────────────────────────────

function StepCompetency({
  form,
  update,
  index,
  type,
  canToggleType = false,
}: {
  form: FormData
  update: (p: Partial<FormData>) => void
  index: 1 | 2 | 3 | 4 | 5
  type: 'positive' | 'constructive' | 'either'
  canToggleType?: boolean
}) {
  const key = (['competencyOne','competencyTwo','competencyThree','competencyFour','competencyFive'] as const)[index - 1]
  const entry = form[key]
  const effectiveType: 'positive' | 'constructive' = canToggleType ? form.competencyFiveType : (type as 'positive' | 'constructive')

  const usedCompetencies = [
    form.competencyOne.competency,
    form.competencyTwo.competency,
    form.competencyThree.competency,
    form.competencyFour.competency,
    form.competencyFive.competency,
  ].filter((_, i) => i !== index - 1)

  function updateEntry(patch: Partial<CompetencyEntry>) {
    update({ [key]: { ...entry, ...patch } })
  }
  function updateExample(i: 0 | 1 | 2, val: string) {
    const ex: [string, string, string] = [...entry.examples] as [string, string, string]
    ex[i] = val
    updateEntry({ examples: ex })
  }

  const selectedDef = COMPETENCIES.find(c => c.name === entry.competency)?.definition
  const typeLabel = effectiveType === 'positive' ? 'Positive Strength' : 'Constructive Area'
  const typeBadgeColor = effectiveType === 'positive'
    ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400'
    : 'border-orange-700/50 bg-orange-900/20 text-orange-400'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">Competency {index}</h2>
          <p className="text-[12px] text-gray-500">Select a competency, then add up to 3 behavioral examples. Use ✨ AI Draft on any example for help.</p>
        </div>
        {canToggleType ? (
          <div className="flex gap-1.5 flex-shrink-0">
            {(['positive','constructive'] as const).map(t => (
              <button key={t} onClick={() => update({ competencyFiveType: t })}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all capitalize ${
                  form.competencyFiveType === t ? typeBadgeColor : 'border-[#1e2030] text-gray-600 hover:text-gray-400'
                }`}>
                {t}
              </button>
            ))}
          </div>
        ) : (
          <span className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium flex-shrink-0 ${typeBadgeColor}`}>
            {typeLabel}
          </span>
        )}
      </div>

      {/* Competency selector */}
      <div>
        <Label>Competency</Label>
        <CompetencySelect value={entry.competency} onChange={v => updateEntry({ competency: v })} exclude={usedCompetencies} />
        {selectedDef && (
          <p className="mt-2 text-[11px] text-gray-600 italic px-1">{selectedDef}</p>
        )}
      </div>

      {/* Per-example rows */}
      <div>
        <Label>Examples (1–3 specific behavioral examples)</Label>
        <div className="space-y-3 mt-1">
          {([0, 1, 2] as const).map(i => (
            <ExampleRow
              key={i}
              index={i}
              value={entry.examples[i]}
              onChange={v => updateExample(i, v)}
              competency={entry.competency}
              effectiveType={effectiveType}
              employeeName={form.employeeName}
              employeePosition={form.employeePosition}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── AI explanation draft (per goal) ─────────────────────────────────────────

function GoalExplanationDraft({
  goal,
  employeeName,
  role,
  onDraft,
}: {
  goal: GoalEntry
  employeeName: string
  role: string
  onDraft: (explanation: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDraft() {
    if (!goal.text.trim() || !goal.status || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/performance-review/draft-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: goal.text, status: goal.status, employeeName, role }),
      })
      const data = await res.json() as { explanation?: string; error?: string }
      if (data.error) { setError(data.error); return }
      if (data.explanation) onDraft(data.explanation)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const canDraft = !!(goal.text.trim() && goal.status)

  return (
    <div className="flex items-center justify-between mt-1">
      {error ? <p className="text-[10px] text-red-400">{error}</p> : <span />}
      <button
        type="button"
        onClick={handleDraft}
        disabled={!canDraft || loading}
        title={!canDraft ? 'Enter the goal and select an outcome first' : 'AI-draft this explanation'}
        className="flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? <><Loader2 size={10} className="animate-spin" /> Drafting…</>
          : <><Sparkles size={10} /> AI Draft</>}
      </button>
    </div>
  )
}

// ─── Goals step ───────────────────────────────────────────────────────────────

function StepGoals({
  form,
  update,
  saves,
  currentReviewId,
}: {
  form: FormData
  update: (p: Partial<FormData>) => void
  saves: SavedReview[]
  currentReviewId: string
}) {
  const [showImport, setShowImport] = useState(false)
  const [importConfirm, setImportConfirm] = useState<SavedReview | null>(null)

  // Previous reviews that have at least one goal with text
  const importable = saves.filter(
    s => s.id !== currentReviewId && s.form.nextGoals?.some(g => g.text.trim())
  )

  function updateGoal(i: number, patch: Partial<GoalEntry>) {
    const goals = [...form.goals]
    goals[i] = { ...goals[i], ...patch }
    update({ goals })
  }
  function addGoal() {
    if (form.goals.length < 5) update({ goals: [...form.goals, emptyGoal()] })
  }
  function removeGoal(i: number) {
    if (form.goals.length > 1) update({ goals: form.goals.filter((_, idx) => idx !== i) })
  }

  function doImport(save: SavedReview) {
    // Pull next-year goals from the chosen review → reset status/explanation for this year
    const imported: GoalEntry[] = save.form.nextGoals
      .filter(g => g.text.trim())
      .map(g => ({ text: g.text.trim(), status: '' as const, explanation: '' }))
    update({ goals: imported.length ? imported : [emptyGoal()] })
    setImportConfirm(null)
    setShowImport(false)
  }

  const hasCurrentGoals = form.goals.some(g => g.text.trim())

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Goals, Objectives & Accomplishments</h2>
        <p className="text-[12px] text-gray-500">
          Review each goal from this period and mark whether it was successful, unsuccessful, or ongoing.
        </p>
      </div>

      {/* ── Import from previous review ── */}
      {importable.length > 0 && (
        <div className="rounded-xl border border-blue-800/30 bg-blue-900/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowImport(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">📥</span>
              <div>
                <p className="text-[12px] font-medium text-blue-300">Import goals from a previous review</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Pulls last year&apos;s goals so you just mark each outcome</p>
              </div>
            </div>
            <span className="text-[10px] text-gray-600">{showImport ? '▲' : '▼'}</span>
          </button>

          {showImport && (
            <div className="border-t border-blue-800/30 px-4 pb-4 space-y-2 pt-3">
              {importConfirm ? (
                <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-3 space-y-2">
                  <p className="text-[12px] text-amber-300">
                    Replace current goals with goals from <strong>{importConfirm.employeeName}</strong>
                    {importConfirm.form.appraisalPeriod ? ` (${importConfirm.form.appraisalPeriod})` : ''}?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => doImport(importConfirm)}
                      className="flex-1 py-1.5 rounded-lg bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 text-[11px] font-medium transition-colors"
                    >
                      Yes, import
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportConfirm(null)}
                      className="px-3 py-1.5 rounded-lg border border-[#2a2d3a] text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                importable.map(s => {
                  const goalCount = s.form.nextGoals.filter(g => g.text.trim()).length
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => hasCurrentGoals ? setImportConfirm(s) : doImport(s)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#1e2030] bg-[#0d0f1a] hover:border-blue-700/50 hover:bg-blue-900/10 transition-all text-left"
                    >
                      <div>
                        <p className="text-[12px] font-medium text-gray-200">{s.employeeName}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {s.form.appraisalPeriod || 'No period set'} · {goalCount} goal{goalCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-[10px] text-blue-400 font-medium">Import →</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Goal cards ── */}
      <div className="space-y-4">
        {form.goals.map((goal, i) => (
          <div key={i} className="p-4 rounded-xl border border-[#1e2030] bg-[#0a0c14] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">#{i + 1}</span>
              {form.goals.length > 1 && (
                <button type="button" onClick={() => removeGoal(i)} className="text-[10px] text-gray-700 hover:text-red-400 transition-colors">Remove</button>
              )}
            </div>
            <div>
              <Label>Goal / Objective / Accomplishment</Label>
              <TextArea value={goal.text} onChange={v => updateGoal(i, { text: v })} placeholder="Describe the goal, objective, or accomplishment…" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['successful', 'unsuccessful', 'ongoing'] as const).map(s => (
                <button type="button" key={s} onClick={() => updateGoal(i, { status: s })}
                  className={`py-2 rounded-lg border text-[11px] font-medium transition-all capitalize ${
                    goal.status === s
                      ? s === 'successful' ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400'
                        : s === 'unsuccessful' ? 'border-red-800/50 bg-red-900/20 text-red-400'
                        : 'border-amber-700/50 bg-amber-900/20 text-amber-400'
                      : 'border-[#1e2030] text-gray-600 hover:text-gray-400'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            <div>
              <Label>Explanation (why successful / unsuccessful / ongoing)</Label>
              <TextArea value={goal.explanation} onChange={v => updateGoal(i, { explanation: v })} placeholder="Provide context on the outcome…" rows={2} />
              <GoalExplanationDraft
                goal={goal}
                employeeName={form.employeeName}
                role={form.employeePosition}
                onDraft={explanation => updateGoal(i, { explanation })}
              />
            </div>
          </div>
        ))}

        {form.goals.length < 5 && (
          <button type="button" onClick={addGoal} className="w-full py-2 rounded-xl border border-dashed border-[#2a2d3a] text-[12px] text-gray-600 hover:text-gray-400 hover:border-[#3a3d4a] transition-colors">
            + Add goal / accomplishment
          </button>
        )}
      </div>

      {/* Overall Score */}
      <div>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-200 mb-1">Overall Performance Score</h3>
          <p className="text-[11px] text-gray-600">Rate using the INNO SUPPS Star Matrix. 1–2 stars requires HR consultation.</p>
        </div>
        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => update({ overallScore: n })}
              className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                form.overallScore >= n
                  ? 'border-purple-700/60 bg-purple-900/20 text-purple-300'
                  : 'border-[#1e2030] text-gray-700 hover:text-gray-500'
              }`}>
              <Star size={16} className="mx-auto" fill={form.overallScore >= n ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        {form.overallScore > 0 && (
          <div className={`p-3 rounded-xl border border-[#1e2030] bg-[#0a0c14]`}>
            <p className={`text-sm font-semibold ${SCORE_LABELS[form.overallScore].color}`}>
              {form.overallScore}★ — {SCORE_LABELS[form.overallScore].label}
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5">{SCORE_LABELS[form.overallScore].description}</p>
            {form.overallScore <= 2 && (
              <p className="text-[11px] text-red-400 mt-1.5">⚠️ HR consultation required before delivery.</p>
            )}
          </div>
        )}
        <div className="mt-3">
          <Label>Overall Summary Notes (optional)</Label>
          <TextArea value={form.overallSummary} onChange={v => update({ overallSummary: v })} placeholder="Add any overall context or summary for this score…" rows={3} />
        </div>
      </div>
    </div>
  )
}

function StepNextGoals({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [redraftingIndex, setRedraftingIndex] = useState<number | null>(null)
  const [redraftError, setRedraftError] = useState<string>('')
  const [repromptIndex, setRepromptIndex] = useState<number | null>(null)
  const [repromptTexts, setRepromptTexts] = useState<Record<number, string>>({})

  const nextAppraisalPeriod = computeNextAppraisalPeriod(form.appraisalPeriod)

  // Auto-fill empty target dates whenever the appraisal period is set
  useEffect(() => {
    if (!nextAppraisalPeriod) return
    const needsUpdate = form.nextGoals.some(g => !g.targetDate)
    if (!needsUpdate) return
    update({
      nextGoals: form.nextGoals.map(g => ({ ...g, targetDate: g.targetDate || nextAppraisalPeriod })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAppraisalPeriod])

  function updateGoal(i: number, patch: Partial<NextGoal>) {
    const g = [...form.nextGoals]
    g[i] = { ...g[i], ...patch }
    update({ nextGoals: g })
  }

  async function handleAIDraft() {
    setDrafting(true)
    setDraftError('')
    try {
      const payload = {
        employeeName: form.employeeName,
        role: form.employeePosition,
        appraisalPeriod: form.appraisalPeriod,
        nextAppraisalPeriod,
        competencies: [
          { competency: form.competencyOne.competency,   type: 'positive',                examples: form.competencyOne.examples },
          { competency: form.competencyTwo.competency,   type: 'positive',                examples: form.competencyTwo.examples },
          { competency: form.competencyThree.competency, type: 'constructive',            examples: form.competencyThree.examples },
          { competency: form.competencyFour.competency,  type: 'constructive',            examples: form.competencyFour.examples },
          { competency: form.competencyFive.competency,  type: form.competencyFiveType,   examples: form.competencyFive.examples },
        ].filter(c => c.competency),
        goals: form.goals.filter(g => g.text.trim()),
        overallScore: form.overallScore,
        overallSummary: form.overallSummary,
      }
      const res = await fetch('/api/performance-review/draft-next-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { goals?: Array<{ text: string; targetDate: string }>; error?: string }
      if (data.error) { setDraftError(data.error); return }
      if (data.goals?.length) {
        const drafted: NextGoal[] = data.goals.map(g => ({
          text: g.text ?? '',
          targetDate: g.targetDate || nextAppraisalPeriod,
        }))
        while (drafted.length < 3) drafted.push(emptyNextGoal())
        update({ nextGoals: drafted.slice(0, 3) })
      }
    } catch (err) {
      setDraftError(String(err))
    } finally {
      setDrafting(false)
    }
  }

  async function handleRedraft(goalIndex: number, userGuidance?: string) {
    setRedraftingIndex(goalIndex)
    setRedraftError('')
    try {
      const res = await fetch('/api/performance-review/redraft-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalIndex,
          userGuidance: userGuidance?.trim() || undefined,
          existingGoals: form.nextGoals.map(g => ({ text: g.text, targetDate: g.targetDate })),
          employeeName: form.employeeName,
          role: form.employeePosition,
          appraisalPeriod: form.appraisalPeriod,
          nextAppraisalPeriod,
          competencies: [
            { competency: form.competencyOne.competency,   type: 'positive',              examples: form.competencyOne.examples },
            { competency: form.competencyTwo.competency,   type: 'positive',              examples: form.competencyTwo.examples },
            { competency: form.competencyThree.competency, type: 'constructive',          examples: form.competencyThree.examples },
            { competency: form.competencyFour.competency,  type: 'constructive',          examples: form.competencyFour.examples },
            { competency: form.competencyFive.competency,  type: form.competencyFiveType, examples: form.competencyFive.examples },
          ].filter(c => c.competency),
          goals: form.goals.filter(g => g.text.trim()),
          overallScore: form.overallScore,
          overallSummary: form.overallSummary,
        }),
      })
      const data = await res.json() as { goal?: { text: string; targetDate: string }; error?: string }
      if (data.error) { setRedraftError(data.error); return }
      if (data.goal) {
        const updated = [...form.nextGoals]
        updated[goalIndex] = {
          text: data.goal.text,
          targetDate: data.goal.targetDate || nextAppraisalPeriod,
        }
        update({ nextGoals: updated })
        // Close the re-prompt panel on success
        setRepromptIndex(null)
        setRepromptTexts(prev => { const n = { ...prev }; delete n[goalIndex]; return n })
      }
    } catch (err) {
      setRedraftError(String(err))
    } finally {
      setRedraftingIndex(null)
    }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">Next Year&apos;s Goals</h2>
          <p className="text-[12px] text-gray-500">
            Define 2–3 SMART goals for the next review period. Use AI Draft to generate goals directly from this review.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAIDraft}
          disabled={drafting}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-800/80 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
        >
          {drafting
            ? <><Loader2 size={12} className="animate-spin" /> Reviewing…</>
            : <><Sparkles size={12} /> AI Draft Goals</>}
        </button>
      </div>

      {draftError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-800/40 bg-red-900/10 p-3 text-[11px] text-red-300">
          <span className="flex-shrink-0 mt-px">⚠</span>
          <span>{draftError}</span>
        </div>
      )}

      {/* Context summary shown while drafting */}
      {drafting && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-3 space-y-1.5">
          <p className="text-[11px] text-purple-300 font-medium">Reviewing the full performance evaluation…</p>
          <p className="text-[10px] text-gray-600">
            Analysing {[form.competencyOne, form.competencyTwo, form.competencyThree, form.competencyFour, form.competencyFive].filter(c => c.competency).length} competencies
            · {form.goals.filter(g => g.text.trim()).length} goals
            · {form.overallScore > 0 ? `${form.overallScore}★ overall` : 'no score yet'}
          </p>
        </div>
      )}

      {/* SMART reminder */}
      <div className="p-3 rounded-xl border border-blue-800/30 bg-blue-900/10">
        <p className="text-[11px] text-blue-300 font-medium mb-1">SMART Goal Framework</p>
        <p className="text-[11px] text-gray-500">
          <span className="text-gray-400">S</span>pecific · <span className="text-gray-400">M</span>easurable · <span className="text-gray-400">A</span>ttainable · <span className="text-gray-400">R</span>elevant · <span className="text-gray-400">T</span>ime-bound
        </p>
      </div>

      {redraftError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-800/40 bg-red-900/10 p-3 text-[11px] text-red-300">
          <span className="flex-shrink-0 mt-px">⚠</span><span>{redraftError}</span>
        </div>
      )}

      {/* Goal cards */}
      <div className="space-y-4">
        {form.nextGoals.map((goal, i) => {
          const isRedrafting   = redraftingIndex === i
          const isRepromptOpen = repromptIndex === i
          const repromptText   = repromptTexts[i] ?? ''

          return (
            <div
              key={i}
              className={`rounded-xl border bg-[#0a0c14] overflow-hidden transition-colors ${
                isRedrafting || isRepromptOpen ? 'border-purple-700/40' : 'border-[#1e2030]'
              }`}
            >
              <div className="p-4 space-y-3">
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Goal {i + 1}{i === 0 ? ' *' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRepromptIndex(isRepromptOpen ? null : i)
                      setRedraftError('')
                    }}
                    disabled={isRedrafting || drafting}
                    className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRepromptOpen
                      ? <><X size={11} /> Cancel</>
                      : <><RefreshCw size={11} /> Re-prompt</>}
                  </button>
                </div>

                <div>
                  <Label>Goal Description</Label>
                  <TextArea
                    value={goal.text}
                    onChange={v => updateGoal(i, { text: v })}
                    placeholder={i === 0 ? 'e.g. Improve video turnaround time to under 48 hours for standard projects by Q3' : 'Optional'}
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Target Completion Date</Label>
                  <div className="relative">
                    <Input
                      value={goal.targetDate}
                      onChange={v => updateGoal(i, { targetDate: v })}
                      placeholder={nextAppraisalPeriod || 'e.g. 2026 – 2027'}
                    />
                    {nextAppraisalPeriod && !goal.targetDate && (
                      <button
                        type="button"
                        onClick={() => updateGoal(i, { targetDate: nextAppraisalPeriod })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-purple-500 hover:text-purple-300 transition-colors"
                      >
                        Use {nextAppraisalPeriod}
                      </button>
                    )}
                  </div>
                  {nextAppraisalPeriod && goal.targetDate === nextAppraisalPeriod && (
                    <p className="mt-1 text-[10px] text-gray-600">📅 Auto-set to next appraisal period</p>
                  )}
                </div>
              </div>

              {/* Re-prompt panel */}
              {isRepromptOpen && (
                <div className="border-t border-purple-800/30 bg-purple-900/10 px-4 py-3 space-y-2">
                  <p className="text-[11px] text-purple-300/80">
                    Describe what you want this goal to focus on — AI will regenerate it using your guidance.
                  </p>
                  <textarea
                    value={repromptText}
                    onChange={e => setRepromptTexts(prev => ({ ...prev, [i]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && repromptText.trim()) {
                        handleRedraft(i, repromptText)
                      }
                    }}
                    placeholder='e.g. "focus on improving presentation skills" or "something around project deadline management"'
                    rows={2}
                    className="w-full bg-[#0a0c14] border border-purple-800/40 rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-600/60 transition-colors resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRedraft(i, repromptText)}
                      disabled={isRedrafting || !repromptText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-800/80 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium transition-colors"
                    >
                      {isRedrafting
                        ? <><Loader2 size={11} className="animate-spin" /> Generating…</>
                        : <><Sparkles size={11} /> Regenerate Goal {i + 1}</>}
                    </button>
                    <span className="text-[10px] text-gray-700">⌘↵ to submit</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Output ───────────────────────────────────────────────────────────────────

function generateSection(title: string, content: string): string {
  return `${title}\n${'─'.repeat(50)}\n${content}\n`
}

const PREAMBLE = `All employees will have an annual performance review on or around the date of their work anniversary. It is with every intention that the Company will have periodic check-ins to ensure performance is, at minimum, meeting expectations and goal objectives are being met. All employees have the option to request a check-in at their discretion during the review period. However, this does not mean a formal review will be facilitated. Merit increases are determined by several factors including financial health, Company profitability, job performance, and consumer price index. A positive performance review does not guarantee a pay raise or continued employment.`

const PART_ONE_INTRO = `Identify 5-words from the drop-down menu that accurately describe your employee's performance during the relevant review period. Consider what is working about their performance and where improvements can be made. You will need to identify 2-3 positive areas and 2-3 constructive areas for improvement. At least one (1) but no more than three (3) explanations should be provided for each respective word. Please review the Glossary of Terms for the definition of each term.`

const PART_TWO_INTRO = `If the employee had goals and objectives previously determined, indicate their progress and the successful or unsuccessful completion of the goals or objectives and the reason WHY you felt they have successfully or unsuccessfully fulfilled their growth initiatives. List any accomplishments made, either within their goal and objective roadmap or as stand-alone accomplishments. Use the Manager's Guide To Performance Reviews to help you form your evaluation.`

const PART_THREE_INTRO = `Toward the end of the evaluation discussion, work on at least two (2) goals for the employee to meet for the next review period. Discuss roadmaps on how the employee plans to get there and hold them to it. It will be helpful to reference page two of the Managers Guide to Performance Evaluations to help identify, define, and craft goals and objectives using the SMART goal method.`

function buildFullReview(form: FormData): string {
  const scoreLabel = form.overallScore > 0 ? SCORE_LABELS[form.overallScore]?.label ?? '' : ''

  const compEntries = [
    { entry: form.competencyOne,   ordinal: 'ONE',   typeLabel: 'positive' },
    { entry: form.competencyTwo,   ordinal: 'TWO',   typeLabel: 'positive' },
    { entry: form.competencyThree, ordinal: 'THREE', typeLabel: 'constructive' },
    { entry: form.competencyFour,  ordinal: 'FOUR',  typeLabel: 'constructive' },
    { entry: form.competencyFive,  ordinal: 'FIVE',  typeLabel: form.competencyFiveType },
  ]

  const competencyText = compEntries.map(({ entry, ordinal, typeLabel }) => {
    const name = entry.competency || 'SELECT ONE'
    const examples = entry.examples
      .map((ex, i) => `${i + 1}. ${ex.trim() || '[INSERT EXAMPLE]'}`)
      .join('\n')
    return `COMPETENCY ${ordinal} (${typeLabel}): ${name}\nEXPLANATION:\n${examples}`
  }).join('\n\n')

  const goalsText = (() => {
    const filled = form.goals.filter(g => g.text.trim())
    if (!filled.length) return '1.\n2.\n3.\n4.\n5.'
    return filled.map((g, i) => {
      const status = g.status ? ` — ${g.status.toUpperCase()}` : ''
      const explanation = g.explanation.trim() ? `\n   ${g.explanation.trim()}` : ''
      return `${i + 1}. ${g.text.trim()}${status}${explanation}`
    }).join('\n\n')
  })()

  const scoreSection = form.overallScore > 0
    ? `OVERALL PERFORMANCE EVALUATION SUMMARY:\nPlease reference the Managers Guide to performance reviews for the scoring matrix definitions.\n\nOVERALL SCORE: ${form.overallScore} — ${scoreLabel}${form.overallSummary.trim() ? '\n\n' + form.overallSummary.trim() : ''}`
    : `OVERALL PERFORMANCE EVALUATION SUMMARY:\nOVERALL SCORE: [Not scored]`

  const nextGoalsText = (() => {
    const entries = [0, 1, 2].map(i => {
      const g = form.nextGoals[i]
      if (g?.text.trim()) {
        return `${i + 1}.\n${g.text.trim()}${g.targetDate.trim() ? `\nTarget Date: ${g.targetDate.trim()}` : ''}`
      }
      return `${i + 1}.`
    })
    return entries.join('\n\n')
  })()

  const sigLines = `__________________________________                                _______________
Employee Name                                                        Date Signed


__________________________________
Employee Signature`

  return [
    PREAMBLE,
    '',
    `Employee Name: ${form.employeeName || ''}`,
    `Employee Position: ${form.employeePosition || ''}`,
    `Employee Division: ${form.employeeDivision || ''}`,
    `Supervisor Name: ${form.supervisorName || ''}`,
    `Appraisal Period: ${form.appraisalPeriod || ''}`,
    `Review Date: ${form.reviewDate || ''}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'PART ONE',
    PART_ONE_INTRO,
    '',
    'COMPETENCY EVALUATION',
    '',
    competencyText,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'PART TWO',
    PART_TWO_INTRO,
    '',
    'GOALS, OBJECTIVES, ACCOMPLISHMENTS',
    '',
    'Goals/Objectives/Accomplishments: Evaluate the goals and objectives that were met and any accomplishments that have been made over the relevant review period. Indicate whether the goals and objectives were successful/unsuccessful and why:',
    '',
    goalsText,
    '',
    scoreSection,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'PART THREE',
    PART_THREE_INTRO,
    '',
    "Next Year's Goals and Objectives for Future Development: Work on these with the employee and identify anticipated completion dates. These goals and objectives should be included in the following years' evaluation appraisal period.",
    '',
    nextGoalsText,
    '',
    sigLines,
    '',
    'EMPLOYEE COMMENTS',
  ].join('\n')
}

function StepOutput({ form }: { form: FormData }) {
  const [driveStatus, setDriveStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [driveUrl, setDriveUrl]       = useState('')
  const [driveError, setDriveError]   = useState('')

  const scoreInfo = form.overallScore > 0 ? SCORE_LABELS[form.overallScore] : null

  const compEntries = [
    { entry: form.competencyOne,   ordinal: 'ONE',   typeLabel: 'positive' as const },
    { entry: form.competencyTwo,   ordinal: 'TWO',   typeLabel: 'positive' as const },
    { entry: form.competencyThree, ordinal: 'THREE', typeLabel: 'constructive' as const },
    { entry: form.competencyFour,  ordinal: 'FOUR',  typeLabel: 'constructive' as const },
    { entry: form.competencyFive,  ordinal: 'FIVE',  typeLabel: form.competencyFiveType },
  ]

  const fullReview = buildFullReview(form)

  async function handleSendToDrive() {
    setDriveStatus('sending')
    setDriveError('')
    try {
      const res = await fetch('/api/performance-review/send-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error')
      setDriveUrl(data.docUrl)
      setDriveStatus('done')
    } catch (err) {
      setDriveError(String(err))
      setDriveStatus('error')
    }
  }

  // Per-competency copy text matching template format
  const compCopyText = (entry: CompetencyEntry, ordinal: string, typeLabel: string) => {
    const examples = entry.examples
      .map((ex, i) => `${i + 1}. ${ex.trim() || '[INSERT EXAMPLE]'}`)
      .join('\n')
    return `COMPETENCY ${ordinal} (${typeLabel}): ${entry.competency || 'SELECT ONE'}\nEXPLANATION:\n${examples}`
  }

  const goalsForCopy = form.goals.filter(g => g.text.trim()).map((g, i) => {
    const status = g.status ? ` — ${g.status.toUpperCase()}` : ''
    const explanation = g.explanation.trim() ? `\n   ${g.explanation.trim()}` : ''
    return `${i + 1}. ${g.text.trim()}${status}${explanation}`
  }).join('\n\n')

  const scoreCopyText = scoreInfo
    ? `OVERALL PERFORMANCE EVALUATION SUMMARY:\nOVERALL SCORE: ${form.overallScore} — ${scoreInfo.label}${form.overallSummary.trim() ? '\n\n' + form.overallSummary.trim() : ''}`
    : 'OVERALL PERFORMANCE EVALUATION SUMMARY:\nOVERALL SCORE: [Not scored]'

  const nextGoalsCopyText = [0, 1, 2].map(i => {
    const g = form.nextGoals[i]
    if (g?.text.trim()) return `${i + 1}.\n${g.text.trim()}${g.targetDate.trim() ? `\nTarget Date: ${g.targetDate.trim()}` : ''}`
    return `${i + 1}.`
  }).join('\n\n')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">Review Output</h2>
          <p className="text-[12px] text-gray-500">Copy each section into the corresponding Google Doc field.</p>
        </div>
        <CopyButton text={fullReview} label="Copy Full Review" />
      </div>

      {/* Preamble */}
      <div className="rounded-xl border border-[#1e2030] bg-[#0a0c14] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1e2030] bg-[#0d0f1a]">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Policy Statement</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-gray-500 italic leading-relaxed">{PREAMBLE}</p>
        </div>
      </div>

      {/* Header fields */}
      <OutputBlock title="EMPLOYEE INFORMATION" copyText={[
        `Employee Name: ${form.employeeName}`,
        `Employee Position: ${form.employeePosition}`,
        `Employee Division: ${form.employeeDivision}`,
        `Supervisor Name: ${form.supervisorName}`,
        `Appraisal Period: ${form.appraisalPeriod}`,
        `Review Date: ${form.reviewDate}`,
      ].join('\n')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {[
            ['Employee Name', form.employeeName],
            ['Employee Position', form.employeePosition],
            ['Employee Division', form.employeeDivision],
            ['Supervisor Name', form.supervisorName],
            ['Appraisal Period', form.appraisalPeriod],
            ['Review Date', form.reviewDate],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="text-[10px] text-gray-600 shrink-0">{k}:</span>
              <span className="text-[12px] text-gray-300">{v || '—'}</span>
            </div>
          ))}
        </div>
      </OutputBlock>

      {/* PART ONE */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PART ONE</span>
          <div className="flex-1 h-px bg-[#1e2030]" />
          <span className="text-[10px] text-gray-600">COMPETENCY EVALUATION</span>
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">{PART_ONE_INTRO}</p>
        <div className="space-y-2 pt-1">
          {compEntries.map(({ entry, ordinal, typeLabel }, i) => {
            const isPositive = typeLabel === 'positive'
            const badgeColor = isPositive ? 'text-emerald-500' : 'text-orange-500'
            const badge = isPositive ? 'positive' : 'constructive'
            return (
              <OutputBlock
                key={i}
                title={`COMPETENCY ${ordinal} (${badge}): ${entry.competency || 'SELECT ONE'}`}
                badge={undefined}
                badgeColor={badgeColor}
                copyText={compCopyText(entry, ordinal, typeLabel)}
              >
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">EXPLANATION:</p>
                  {[0, 1, 2].map(j => (
                    <p key={j} className="text-[12px] text-gray-300">
                      <span className="text-gray-600">{j + 1}.</span>{' '}
                      {entry.examples[j]?.trim() || <span className="text-gray-700 italic">[INSERT EXAMPLE]</span>}
                    </p>
                  ))}
                </div>
              </OutputBlock>
            )
          })}
        </div>
      </div>

      {/* PART TWO */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PART TWO</span>
          <div className="flex-1 h-px bg-[#1e2030]" />
          <span className="text-[10px] text-gray-600">GOALS, OBJECTIVES & ACCOMPLISHMENTS</span>
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">{PART_TWO_INTRO}</p>
        <OutputBlock title="GOALS, OBJECTIVES, ACCOMPLISHMENTS" copyText={goalsForCopy + '\n\n' + scoreCopyText}>
          <div className="space-y-3">
            <p className="text-[10px] text-gray-600 leading-snug">
              Goals/Objectives/Accomplishments: Evaluate the goals and objectives that were met and any accomplishments that have been made over the relevant review period. Indicate whether the goals and objectives were successful/unsuccessful and why:
            </p>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map(i => {
                const g = form.goals[i]
                if (!g?.text.trim()) {
                  return (
                    <p key={i} className="text-[12px] text-gray-700">
                      <span className="text-gray-600">{i + 1}.</span>
                    </p>
                  )
                }
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-600 text-[12px] shrink-0">{i + 1}.</span>
                      <div className="flex-1">
                        <span className="text-[12px] text-gray-300">{g.text}</span>
                        {g.status && (
                          <span className={`ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            g.status === 'successful' ? 'bg-emerald-900/40 text-emerald-400'
                            : g.status === 'unsuccessful' ? 'bg-red-900/40 text-red-400'
                            : 'bg-amber-900/40 text-amber-400'
                          }`}>{g.status}</span>
                        )}
                        {g.explanation && <p className="text-[11px] text-gray-500 mt-0.5">{g.explanation}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Overall Score */}
            <div className="mt-3 pt-3 border-t border-[#1e2030] space-y-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">OVERALL PERFORMANCE EVALUATION SUMMARY</p>
              <p className="text-[10px] text-gray-700">Please reference the Managers Guide to performance reviews for the scoring matrix definitions.</p>
              {scoreInfo ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600 uppercase tracking-wider">OVERALL SCORE</span>
                  <span className={`text-sm font-bold ${scoreInfo.color}`}>{form.overallScore}</span>
                  <span className={`text-[12px] font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</span>
                </div>
              ) : (
                <p className="text-[12px] text-gray-600 italic mt-1">Not scored yet.</p>
              )}
              {form.overallSummary && <p className="text-[11px] text-gray-400 mt-1">{form.overallSummary}</p>}
            </div>
          </div>
        </OutputBlock>
      </div>

      {/* PART THREE */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PART THREE</span>
          <div className="flex-1 h-px bg-[#1e2030]" />
          <span className="text-[10px] text-gray-600">NEXT YEAR&apos;S GOALS</span>
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">{PART_THREE_INTRO}</p>
        <OutputBlock title="NEXT YEAR'S GOALS AND OBJECTIVES" copyText={nextGoalsCopyText}>
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-600 leading-snug mb-2">
              Next Year&apos;s Goals and Objectives for Future Development: Work on these with the employee and identify anticipated completion dates. These goals and objectives should be included in the following years&apos; evaluation appraisal period.
            </p>
            {[0, 1, 2].map(i => {
              const g = form.nextGoals[i]
              const hasText = g?.text.trim()
              return (
                <div key={i} className="space-y-0.5">
                  <p className="text-[12px] text-gray-300">
                    <span className="text-gray-600">{i + 1}.</span>{' '}
                    {hasText ? g.text : <span className="text-gray-700 italic">(not set)</span>}
                  </p>
                  {hasText && g.targetDate && (
                    <p className="text-[11px] text-gray-500 ml-4">Target Date: {g.targetDate}</p>
                  )}
                </div>
              )
            })}
          </div>
        </OutputBlock>
      </div>

      {/* Signature & Employee Comments */}
      <OutputBlock title="SIGNATURES & EMPLOYEE COMMENTS" copyText={`__________________________________                                _______________\nEmployee Name                                                        Date Signed\n\n\n__________________________________\nEmployee Signature\n\n\nEMPLOYEE COMMENTS`}>
        <div className="space-y-4">
          <div className="flex items-end gap-10">
            <div className="space-y-1 flex-1">
              <div className="h-px bg-gray-700 w-56" />
              <p className="text-[10px] text-gray-600">Employee Name</p>
            </div>
            <div className="space-y-1 w-32">
              <div className="h-px bg-gray-700 w-32" />
              <p className="text-[10px] text-gray-600">Date Signed</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-px bg-gray-700 w-56" />
            <p className="text-[10px] text-gray-600">Employee Signature</p>
          </div>
          <div className="pt-2 border-t border-[#1e2030]">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">EMPLOYEE COMMENTS</p>
            <div className="h-16 rounded border border-dashed border-[#2a2d3e] bg-[#0d0f1a]/50" />
          </div>
        </div>
      </OutputBlock>

      {/* ── Approve & Send to Drive ── */}
      <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-emerald-300">Approve &amp; Send to Drive</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Creates a formatted Google Doc in the Performance Reviews folder and opens it for you.
            </p>
          </div>

          {driveStatus === 'idle' || driveStatus === 'error' ? (
            <button
              onClick={handleSendToDrive}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition-colors shrink-0"
            >
              {/* Google Drive logo */}
              <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path fill="#0066da" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a15.4 15.4 0 003.3 8.5z"/>
                <path fill="#00ac47" d="M43.65 25L29.9 1.2a15.4 15.4 0 00-3.3 3.3L.95 50.3A15.4 15.4 0 000 55.65h27.5z"/>
                <path fill="#ea4335" d="M73.55 76.8a15.4 15.4 0 003.3-3.3l1.6-2.75 7.65-13.2a15.4 15.4 0 001-5.35H59.6l5.85 11.5z"/>
                <path fill="#00832d" d="M43.65 25L57.4 1.2a15.4 15.4 0 00-8.35-1.2H38.3a15.4 15.4 0 00-8.4 1.2z"/>
                <path fill="#2684fc" d="M59.6 55.65h27.5a15.4 15.4 0 00-1-5.35L62.85 8.5A15.4 15.4 0 0059.55 5.2L43.65 25z"/>
                <path fill="#00ac47" d="M43.65 25L27.5 55.65H59.6z"/>
              </svg>
              Approve &amp; Send to Drive
            </button>
          ) : driveStatus === 'sending' ? (
            <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-800 text-emerald-400 text-[13px] font-semibold shrink-0 cursor-not-allowed">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating document…
            </button>
          ) : (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[13px] font-semibold transition-colors shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              Open in Google Docs ↗
            </a>
          )}
        </div>

        {driveStatus === 'done' && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/40 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Document saved to your Performance Reviews folder.</span>
            <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="ml-auto underline hover:text-emerald-300 shrink-0">View →</a>
          </div>
        )}

        {driveStatus === 'error' && (
          <div className="text-[11px] text-red-400 bg-red-950/30 rounded-lg px-3 py-2">
            <span className="font-semibold">Error: </span>{driveError}
          </div>
        )}
      </div>
    </div>
  )
}

function OutputBlock({
  title, badge, badgeColor, copyText, children,
}: {
  title: string
  badge?: string
  badgeColor?: string
  copyText: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#1e2030] bg-[#0a0c14] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2030] bg-[#0d0f1a]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-300">{title}</span>
          {badge && <span className={`text-[10px] font-medium ${badgeColor}`}>{badge}</span>}
        </div>
        <CopyButton text={copyText} />
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function PerformanceReviewForm() {
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [form, setForm] = useState<FormData>(defaultForm())
  const [saves, setSaves] = useState<SavedReview[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const reviewIdRef = useRef('')

  // Init: auto-resume the most recent save, or start fresh if nothing saved yet
  useEffect(() => {
    const existing = getSaves()
    if (existing.length > 0) {
      // Saves are stored newest-first — pick the most recently modified
      const latest = existing[0]
      reviewIdRef.current = latest.id
      setForm(latest.form)
      setStep(latest.step)
      setMaxStep(latest.maxStep ?? latest.step)
      setSaveStatus('saved')
    } else {
      reviewIdRef.current = crypto.randomUUID()
    }
    setSaves(existing)
  }, [])

  // Keep maxStep as the high-water mark — never goes backward
  useEffect(() => {
    setMaxStep(prev => Math.max(prev, step))
  }, [step])

  // Auto-save 1.5s after any form/step change (only once employee name is entered)
  useEffect(() => {
    if (!form.employeeName.trim()) return
    setSaveStatus('saving')
    const timer = setTimeout(() => {
      upsertSave({
        id: reviewIdRef.current,
        employeeName: form.employeeName,
        employeePosition: form.employeePosition,
        step,
        maxStep,
        savedAt: new Date().toISOString(),
        form,
      })
      setSaves(getSaves())
      setSaveStatus('saved')
    }, 1500)
    return () => clearTimeout(timer)
  }, [form, step, maxStep])

  function handleLoad(save: SavedReview) {
    reviewIdRef.current = save.id
    setForm(save.form)
    setStep(save.step)
    setMaxStep(save.maxStep ?? save.step)
    setShowHistory(false)
    setSaveStatus('saved')
  }

  function handleDelete(id: string) {
    deleteSave(id)
    setSaves(getSaves())
  }

  function handleNewReview() {
    reviewIdRef.current = crypto.randomUUID()
    setForm(defaultForm())
    setStep(0)
    setMaxStep(0)
    setSaveStatus('idle')
  }

  function update(patch: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!(form.employeeName.trim() && form.supervisorName.trim())
      case 1: return !!(form.competencyOne.competency && form.competencyOne.examples[0].trim())
      case 2: return !!(form.competencyTwo.competency && form.competencyTwo.examples[0].trim())
      case 3: return !!(form.competencyThree.competency && form.competencyThree.examples[0].trim())
      case 4: return !!(form.competencyFour.competency && form.competencyFour.examples[0].trim())
      case 5: return !!(form.competencyFive.competency && form.competencyFive.examples[0].trim())
      case 6: return !!(form.goals.some(g => g.text.trim()) && form.overallScore > 0)
      case 7: return form.nextGoals.some(g => g.text.trim())
      default: return true
    }
  }

  const currentStep = STEPS[step]

  // How many of the 8 content steps (0–7, excluding Review Output) are actually filled
  const CONTENT_STEP_COUNT      = STEPS.length - 1 // 8
  const filledStepsCount        = Array.from({ length: CONTENT_STEP_COUNT }, (_, i) => i)
    .filter(i => isStepComplete(i, form)).length
  const allContentStepsComplete = filledStepsCount === CONTENT_STEP_COUNT

  return (
    <div className="min-h-screen bg-[#0b0d14] text-white">
      {showHistory && (
        <HistoryPanel
          saves={saves}
          currentId={reviewIdRef.current}
          onLoad={handleLoad}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h1 className="text-xl font-bold text-gray-100">Manager Performance Review</h1>
                <p className="text-[12px] text-gray-500 mt-0.5">Fill out each section — copy individual parts or the full review at the end.</p>
              </div>
            </div>

            {/* Save status + history */}
            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
              {saveStatus === 'saving' && (
                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Saved
                </span>
              )}
              <button
                type="button"
                onClick={handleNewReview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-800/80 hover:bg-purple-700 text-[11px] text-white font-medium transition-colors"
              >
                + Create New
              </button>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e2030] bg-[#0d0f1a] text-[11px] text-gray-500 hover:text-gray-200 hover:border-[#2a2d3a] transition-all"
              >
                <History size={12} />
                History
                {saves.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-purple-700 text-[9px] font-bold text-white flex items-center justify-center">
                    {saves.length > 9 ? '9+' : saves.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Step progress */}
        <div className="mb-8">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {STEPS.map((s, i) => {
              const isOutput   = i === STEPS.length - 1
              const canAccess  = isOutput ? allContentStepsComplete : true
              const isActive   = i === step
              const isDone     = !isActive && isStepComplete(i, form)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => canAccess && setStep(i)}
                  disabled={!canAccess}
                  title={isOutput && !canAccess ? 'Complete all steps before reviewing' : undefined}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-purple-800/60 text-purple-200 border border-purple-700/50'
                      : isOutput && !canAccess
                      ? 'text-gray-700 cursor-not-allowed opacity-50'
                      : isDone
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-[#1e2030]'
                      : 'text-gray-600 hover:text-gray-300 hover:bg-[#1e2030]'
                  }`}
                >
                  {!isActive && isDone
                    ? <CheckCircle2 size={11} className="text-emerald-500" />
                    : isOutput && !canAccess
                    ? <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">🔒</span>
                    : <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{i + 1}</span>}
                  {s.label}
                </button>
              )
            })}
          </div>
          {/* Progress bar — driven by actual filled steps */}
          <div className="mt-2 h-0.5 bg-[#1e2030] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allContentStepsComplete ? 'bg-emerald-500' : 'bg-purple-600'}`}
              style={{ width: `${(filledStepsCount / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Part label */}
        {currentStep.part && (
          <div className="mb-4 px-3 py-1.5 rounded-lg bg-[#0d0f1a] border border-[#1e2030] inline-flex">
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">{currentStep.part}</span>
          </div>
        )}

        {/* Step content */}
        <div className="bg-[#0d0f1a] rounded-2xl border border-[#1e2030] p-6 mb-6">
          {step === 0 && <StepInfo form={form} update={update} />}
          {step === 1 && <StepCompetency form={form} update={update} index={1} type="positive" />}
          {step === 2 && <StepCompetency form={form} update={update} index={2} type="positive" />}
          {step === 3 && <StepCompetency form={form} update={update} index={3} type="constructive" />}
          {step === 4 && <StepCompetency form={form} update={update} index={4} type="constructive" />}
          {step === 5 && <StepCompetency form={form} update={update} index={5} type="either" canToggleType />}
          {step === 6 && <StepGoals form={form} update={update} saves={saves} currentReviewId={reviewIdRef.current} />}
          {step === 7 && <StepNextGoals form={form} update={update} />}
          {step === 8 && <StepOutput form={form} />}
        </div>

        {/* Navigation */}
        {step < STEPS.length - 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2030] text-sm text-gray-400 hover:text-gray-200 hover:border-[#2a2d3a] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === STEPS.length - 2 ? !allContentStepsComplete : !canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-800/80 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {step === STEPS.length - 2 ? 'Generate Review' : 'Continue'}
                <ChevronRight size={15} />
              </button>
            </div>
            {/* Incomplete warning shown only on last content step */}
            {step === STEPS.length - 2 && !allContentStepsComplete && (
              <p className="text-[11px] text-amber-500/80 text-right">
                {CONTENT_STEP_COUNT - filledStepsCount} step{CONTENT_STEP_COUNT - filledStepsCount !== 1 ? 's' : ''} still need content before you can generate the review.
              </p>
            )}
          </div>
        )}

        {step === STEPS.length - 1 && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2030] text-sm text-gray-400 hover:text-gray-200 hover:border-[#2a2d3a] transition-all"
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              type="button"
              onClick={handleNewReview}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2030] text-sm text-gray-400 hover:text-red-400 hover:border-red-800/50 transition-all"
            >
              Start New Review
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
