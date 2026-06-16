'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Loader2, Star, History, X, Clock, RefreshCw, Users, Plus, Pencil, Trash2, Settings, FileText, Link, AlignLeft, LogOut, BookOpen, BookMarked, Bell } from 'lucide-react'
import { SignaturePad, SignatureDisplay, encodeSignature, type SignatureResult } from '@/components/SignaturePad'

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
  employeePronouns: string
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
  employeePronouns: '',
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

// ─── Direct Reports ───────────────────────────────────────────────────────────

interface DirectReport {
  id: string
  name: string
  position: string
  division: string
  pronouns: string   // e.g. "he/him", "she/her", "they/them", or custom
}

const REPORTS_KEY = 'manager-direct-reports'

function getReports(): DirectReport[] {
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY) ?? '[]') } catch { return [] }
}
function saveReports(reports: DirectReport[]): void {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'manager-perf-review-settings'

interface AppSettings {
  driveFolderUrl: string
}

function getSettings(): AppSettings {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } catch { return { driveFolderUrl: '' } }
}
function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

/** Extract a Google Drive folder ID from a URL or return the raw string if it looks like an ID already. */
function parseFolderId(urlOrId: string): string {
  const trimmed = urlOrId.trim()
  // Match /folders/<id> in a Drive URL
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // If it looks like a raw ID (no slashes, long alphanumeric), use as-is
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed
  return ''
}

// ─── Save / load ─────────────────────────────────────────────────────────────

interface SavedReview {
  id: string
  employeeName: string
  employeePosition: string
  step: number      // current position (restored on resume)
  maxStep: number   // furthest step ever reached (shown in history)
  savedAt: string   // ISO timestamp
  form: FormData
  driveUrl?: string        // Google Doc link once generated
  driveDocId?: string
  comparisonReport?: string // saved AI comparison report
  employeeId?: string
  managerSignedAt?: string
  managerSignature?: string
}

/** Returns true if a step's required fields are filled — independent of current position. */
function isStepComplete(stepIndex: number, form: FormData): boolean {
  if (!form) return false
  switch (stepIndex) {
    case 0: return !!(form.employeeName?.trim() && form.supervisorName?.trim())
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
  try {
    const raw = JSON.parse(localStorage.getItem(SAVES_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((s: SavedReview) => s && s.form) : []
  }
  catch { return [] }
}

function upsertSave(review: SavedReview): void {
  const saves = getSaves()
  const idx = saves.findIndex(s => s.id === review.id)
  if (idx >= 0) saves[idx] = { ...saves[idx], ...review } // merge to preserve driveUrl, comparisonReport etc.
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

function DirectReportsPanel({
  reports,
  onSave,
  onDelete,
  onClose,
}: {
  reports: DirectReport[]
  onSave: (r: DirectReport) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const PRESET_PRONOUNS = ['he/him', 'she/her', 'they/them']
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', position: '', division: '', pronouns: '' })
  const [isAdding, setIsAdding] = useState(false)

  function startAdd() {
    setEditingId(null)
    setForm({ name: '', position: '', division: '', pronouns: '' })
    setIsAdding(true)
  }

  function startEdit(r: DirectReport) {
    setIsAdding(false)
    setEditingId(r.id)
    setForm({ name: r.name, position: r.position, division: r.division, pronouns: r.pronouns ?? '' })
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      id: editingId ?? crypto.randomUUID(),
      name: form.name.trim(),
      position: form.position.trim(),
      division: form.division.trim(),
      pronouns: form.pronouns.trim(),
    })
    setIsAdding(false)
    setEditingId(null)
    setForm({ name: '', position: '', division: '', pronouns: '' })
  }

  function cancel() {
    setIsAdding(false)
    setEditingId(null)
    setForm({ name: '', position: '', division: '', pronouns: '' })
  }

  const showForm = isAdding || editingId !== null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0b0d14] border-l border-[#1e2030] flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2030] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
              <Users size={14} className="text-purple-400" /> My Team
            </h2>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {reports.length === 0 ? 'No direct reports added yet' : `${reports.length} direct report${reports.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-800/80 hover:bg-purple-700 text-[11px] text-white font-medium transition-colors"
            >
              <Plus size={11} /> Add
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#1e2030] transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2
          [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-[#2a2d3a] [&::-webkit-scrollbar-thumb]:rounded-full">

          {/* Add / Edit form */}
          {showForm && (
            <div className="rounded-xl border border-purple-700/40 bg-purple-900/10 p-4 space-y-3 mb-2">
              <p className="text-[11px] font-semibold text-purple-300">{editingId ? 'Edit Direct Report' : 'Add Direct Report'}</p>
              <div className="space-y-2">
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name *"
                  className="w-full bg-[#0d0f1a] border border-[#2a2d3a] rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600"
                />
                <input
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="Position / Title"
                  className="w-full bg-[#0d0f1a] border border-[#2a2d3a] rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600"
                />
                <input
                  value={form.division}
                  onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                  placeholder="Division / Department"
                  className="w-full bg-[#0d0f1a] border border-[#2a2d3a] rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600"
                />
                {/* Pronouns */}
                <div className="space-y-1.5 pt-0.5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Pronouns (used by AI when drafting)</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_PRONOUNS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, pronouns: f.pronouns === p ? '' : p }))}
                        className={`px-3 py-1 rounded-lg text-[11px] border transition-all ${
                          form.pronouns === p
                            ? 'border-purple-600 bg-purple-900/30 text-purple-200'
                            : 'border-[#2a2d3a] text-gray-500 hover:text-gray-300 hover:border-[#3a3d4a]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <input
                      value={PRESET_PRONOUNS.includes(form.pronouns) ? '' : form.pronouns}
                      onChange={e => setForm(f => ({ ...f, pronouns: e.target.value }))}
                      onFocus={() => { if (PRESET_PRONOUNS.includes(form.pronouns)) setForm(f => ({ ...f, pronouns: '' })) }}
                      placeholder="Custom…"
                      className="flex-1 min-w-[70px] bg-[#0d0f1a] border border-[#2a2d3a] rounded-lg px-2.5 py-1 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-[11px] font-medium transition-colors"
                >
                  {editingId ? 'Save Changes' : 'Add'}
                </button>
                <button
                  onClick={cancel}
                  className="px-3 py-1.5 rounded-lg border border-[#2a2d3a] text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {reports.length === 0 && !showForm && (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-sm text-gray-500">No direct reports yet</p>
              <p className="text-[11px] text-gray-700 mt-1.5 max-w-[200px] mx-auto leading-relaxed">
                Add your team members so you can quickly select them when starting a review
              </p>
            </div>
          )}

          {reports.map(r => (
            <div key={r.id} className="rounded-xl border border-[#1e2030] bg-[#0d0f1a] p-4">
              {editingId === r.id ? null : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-gray-200">{r.name}</p>
                    {r.position && <p className="text-[11px] text-gray-500 mt-0.5">{r.position}</p>}
                    {r.division && <p className="text-[11px] text-gray-600 mt-0.5">{r.division}</p>}
                    {r.pronouns && <p className="text-[10px] text-purple-500/70 mt-0.5">{r.pronouns}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(r)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#1e2030] transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}) {
  const [folderUrl, setFolderUrl] = useState(settings.driveFolderUrl)

  const folderId  = parseFolderId(folderUrl)
  const isValid   = folderUrl.trim() === '' || folderId !== ''

  function handleSave() {
    onSave({ driveFolderUrl: folderUrl.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0b0d14] border-l border-[#1e2030] flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2030] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
              <Settings size={14} className="text-purple-400" /> Settings
            </h2>
            <p className="text-[11px] text-gray-600 mt-0.5">Saved to this browser</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#1e2030] transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Drive folder */}
          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-semibold text-gray-300">Google Drive Save Location</p>
              <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                Paste the URL of the Drive folder where generated docs should be saved.
                Leave blank to use the default folder.
              </p>
            </div>
            <input
              value={folderUrl}
              onChange={e => setFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className={`w-full bg-[#0d0f1a] border rounded-xl px-4 py-2.5 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none transition-colors ${
                !isValid ? 'border-red-700/60 focus:border-red-600' : 'border-[#2a2d3a] focus:border-purple-600'
              }`}
            />
            {!isValid && (
              <p className="text-[10px] text-red-400">Couldn&apos;t find a folder ID in that URL — check the link and try again.</p>
            )}
            {folderId && isValid && (
              <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                <CheckCircle2 size={10} /> Folder ID: <span className="font-mono">{folderId}</span>
              </p>
            )}
            {!folderUrl.trim() && (
              <p className="text-[10px] text-gray-600">Using the default folder configured on the server.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[#1e2030] flex gap-2">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-[12px] font-medium transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#2a2d3a] text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

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
  pronouns?: string,
): Promise<string> {
  const res = await fetch('/api/performance-review/draft-example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competency, type, employeeName, role, context, exampleIndex, pronouns }),
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

type DbTeamMemberForStep = { id: string; name: string | null; email: string; start_date: string | null; position: string | null; division: string | null; pronouns: string | null }

function computeAppraisalPeriod(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  if (isNaN(start.getTime())) return ''
  const today = new Date()
  let anniversaryYear = today.getFullYear()
  const thisYearAnniversary = new Date(anniversaryYear, start.getMonth(), start.getDate())
  if (thisYearAnniversary > today) anniversaryYear -= 1
  const periodStart = new Date(anniversaryYear, start.getMonth(), start.getDate())
  const periodEnd = new Date(anniversaryYear + 1, start.getMonth(), start.getDate())
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return `${fmt(periodStart)} – ${fmt(periodEnd)}`
}

function computeReviewDate(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  if (isNaN(start.getTime())) return ''
  const today = new Date()
  let anniversaryYear = today.getFullYear()
  const thisYearAnniversary = new Date(anniversaryYear, start.getMonth(), start.getDate())
  if (thisYearAnniversary > today) anniversaryYear -= 1
  const periodStart = new Date(anniversaryYear, start.getMonth(), start.getDate())
  return periodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function StepInfo({
  form,
}: {
  form: FormData
  update: (p: Partial<FormData>) => void
  directReports: DirectReport[]
  dbTeam?: DbTeamMemberForStep[]
  managerName?: string
}) {
  const fields = [
    { label: 'Employee Name',        value: form.employeeName },
    { label: 'Position / Title',     value: form.employeePosition },
    { label: 'Division',             value: form.employeeDivision },
    { label: 'Supervisor',           value: form.supervisorName },
    { label: 'Appraisal Period',     value: form.appraisalPeriod },
    { label: 'Review Date',          value: form.reviewDate },
    { label: 'Pronouns',             value: form.employeePronouns },
  ]

  const missingFields = fields.filter(f => !f.value?.trim()).map(f => f.label)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Confirm Employee Information</h2>
        <p className="text-[12px] text-gray-500">Review the details below before continuing. To make changes, contact your admin.</p>
      </div>

      {missingFields.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3">
          <span className="text-amber-400 text-base mt-0.5">⚠</span>
          <div>
            <p className="text-[12px] font-semibold text-amber-300 mb-0.5">Some fields are missing</p>
            <p className="text-[11px] text-amber-500/80 leading-relaxed">
              <strong>{missingFields.join(', ')}</strong> {missingFields.length === 1 ? 'is' : 'are'} not set in this employee&apos;s profile.
              An admin can update these in the <strong>Admin → Users</strong> table. You can still continue the review.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.label} className={`bg-[#13151f] border rounded-xl px-4 py-3 ${!f.value?.trim() ? 'border-amber-900/40' : 'border-[#1e2130]'}`}>
            <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">{f.label}</div>
            <div className="text-[13px] font-medium text-gray-200">{f.value || <span className="text-amber-700/80 font-normal text-[12px]">Not set — update in admin portal</span>}</div>
          </div>
        ))}
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
  employeePronouns,
}: {
  index: 0 | 1 | 2
  value: string
  onChange: (v: string) => void
  competency: string
  effectiveType: 'positive' | 'constructive'
  employeeName: string
  employeePosition: string
  employeePronouns?: string
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
        competency, effectiveType, employeeName, employeePosition, context, index, employeePronouns
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
              employeePronouns={form.employeePronouns}
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
  pronouns,
  onDraft,
}: {
  goal: GoalEntry
  employeeName: string
  role: string
  pronouns?: string
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
        body: JSON.stringify({ goalText: goal.text, status: goal.status, employeeName, role, pronouns }),
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
                pronouns={form.employeePronouns}
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
        pronouns: form.employeePronouns,
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
          pronouns: form.employeePronouns,
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

// ─── Markdown rendering helpers (module-level, not inside JSX) ───────────────

/** Replace **bold** with <strong> elements inline */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="text-gray-200 font-semibold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

/** Render a single body line with bullet/numbered/paragraph handling */
function renderBodyLine(line: string, li: number): React.ReactNode {
  const trimmed = line.trim()
  if (!trimmed) return <div key={li} className="h-1" />
  if (/^[-*]\s/.test(trimmed)) {
    return (
      <div key={li} className="flex gap-2 text-[12px] text-gray-400 leading-relaxed">
        <span className="text-purple-500 mt-0.5 flex-shrink-0">•</span>
        <span>{renderInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
      </div>
    )
  }
  if (/^\d+\.\s/.test(trimmed)) {
    const num  = trimmed.match(/^(\d+)\./)?.[1] ?? ''
    const rest = trimmed.replace(/^\d+\.\s+/, '')
    return (
      <div key={li} className="flex gap-2 text-[12px] text-gray-400 leading-relaxed">
        <span className="text-purple-500 flex-shrink-0 w-4 text-right">{num}.</span>
        <span>{renderInline(rest)}</span>
      </div>
    )
  }
  return (
    <p key={li} className="text-[12px] text-gray-400 leading-relaxed">
      {renderInline(trimmed)}
    </p>
  )
}

/** Render a full markdown comparison report */
function renderComparisonReport(report: string): React.ReactNode {
  return report.split(/\n(?=## )/).map((section, idx) => {
    const lines      = section.trim().split('\n')
    const rawHeading = lines[0]
    const isHeading  = rawHeading.startsWith('## ')
    const heading    = isHeading ? rawHeading.replace(/^##\s*/, '') : ''
    const bodyLines  = isHeading ? lines.slice(1) : lines

    const [hColor, bColor] =
      heading.includes('AGREE') || heading.includes('ALIGN') ? ['text-emerald-400', 'border-emerald-900/40'] :
      heading.includes('DIFFER')                              ? ['text-amber-400',   'border-amber-900/40']   :
      heading.includes('TALKING')                             ? ['text-blue-400',    'border-blue-900/40']    :
      heading.includes('ACTION') || heading.includes('PLAN')  ? ['text-purple-400',  'border-purple-900/40']  :
      heading.includes('GOAL')                                ? ['text-cyan-400',    'border-cyan-900/40']    :
                                                                ['text-gray-200',    'border-[#1e2030]']

    return (
      <div key={idx} className={`space-y-2 pt-4 first:pt-0 border-t first:border-t-0 ${bColor}`}>
        {heading && (
          <p className={`text-[10px] font-bold uppercase tracking-widest ${hColor}`}>{heading}</p>
        )}
        <div className="space-y-1.5">
          {bodyLines.map((line, li) => renderBodyLine(line, li))}
        </div>
      </div>
    )
  })
}

// ─── DriveExportSection ───────────────────────────────────────────────────────

function DriveExportSection({
  form, driveFolderId, savedDriveUrl, savedDriveDocId, onDriveSaved, employeeId, managerEmail
}: {
  form: FormData
  driveFolderId?: string
  savedDriveUrl?: string
  savedDriveDocId?: string
  onDriveSaved?: (url: string, docId: string) => void
  employeeId?: string
  managerEmail?: string
}) {
  const [driveStatus, setDriveStatus] = useState<'idle' | 'checking' | 'sending' | 'done' | 'error'>(
    savedDriveUrl ? 'checking' : 'idle'
  )
  const [driveUrl, setDriveUrl] = useState(savedDriveUrl ?? '')
  const [driveError, setDriveError] = useState('')
  const [showManualLink, setShowManualLink] = useState(false)
  const [manualLinkValue, setManualLinkValue] = useState('')
  const [manualLinkError, setManualLinkError] = useState('')

  // Validate saved Drive link on mount — reset to idle if doc was deleted
  useEffect(() => {
    if (!savedDriveDocId) return
    fetch(`/api/performance-review/check-doc?id=${savedDriveDocId}`)
      .then(r => r.json())
      .then((data: { ok: boolean }) => {
        if (data.ok) {
          setDriveStatus('done')
        } else {
          setDriveStatus('idle')
          setDriveUrl('')
          onDriveSaved?.('', '') // clear the stale link in parent
        }
      })
      .catch(() => setDriveStatus('done')) // network error → assume doc still exists
  }, [savedDriveDocId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveManualLink() {
    const val = manualLinkValue.trim()
    if (!val) { setManualLinkError('Please enter a URL.'); return }
    if (!val.startsWith('https://docs.google.com/') && !val.startsWith('https://drive.google.com/')) {
      setManualLinkError('Must be a Google Docs or Drive URL.')
      return
    }
    setDriveUrl(val)
    setDriveStatus('done')
    setManualLinkError('')
    setShowManualLink(false)
    setManualLinkValue('')
    onDriveSaved?.(val, '')
  }

  async function handleSendToDrive() {
    setDriveStatus('sending')
    setDriveError('')
    try {
      const res = await fetch('/api/performance-review/send-to-drive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...(driveFolderId ? { driveFolderId } : {}),
          ...(employeeId ? { employeeId } : {}),
          ...(managerEmail ? { managerEmail } : {}),
        }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (status ${res.status}). Check server logs.`)
      }
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error')
      setDriveUrl(data.docUrl)
      setDriveStatus('done')
      onDriveSaved?.(data.docUrl, data.docId)
    } catch (err) {
      setDriveError(String(err))
      setDriveStatus('error')
    }
  }

  return (
    <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-emerald-300">Approve &amp; Send to Drive</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Creates a formatted Google Doc in the Performance Reviews folder and opens it for you.
          </p>
        </div>

        {driveStatus === 'checking' ? (
          <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0d0f1a] border border-[#1e2030] text-gray-600 text-[13px] font-semibold shrink-0 cursor-not-allowed">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking link…
          </button>
        ) : driveStatus === 'idle' || driveStatus === 'error' ? (
          <button
            onClick={handleSendToDrive}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition-colors shrink-0"
          >
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
          <span className="truncate">{driveUrl}</span>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="ml-auto underline hover:text-emerald-300 shrink-0">Open →</a>
        </div>
      )}

      {driveStatus === 'error' && (
        <div className="text-[11px] text-red-400 bg-red-950/30 rounded-lg px-3 py-2">
          <span className="font-semibold">Error: </span>{driveError}
        </div>
      )}

      {(driveStatus === 'idle' || driveStatus === 'error' || driveStatus === 'done') && (
        <div>
          {!showManualLink ? (
            <button
              type="button"
              onClick={() => { setShowManualLink(true); setManualLinkValue(driveUrl || '') }}
              className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors underline-offset-2 hover:underline"
            >
              {driveStatus === 'done' ? 'Replace with a different link' : 'Already have a doc? Paste the link manually'}
            </button>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-gray-500">Paste a Google Docs or Drive URL:</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={manualLinkValue}
                  onChange={e => { setManualLinkValue(e.target.value); setManualLinkError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveManualLink() }}
                  placeholder="https://docs.google.com/document/d/..."
                  className="flex-1 bg-[#0a0c14] border border-[#2a2d3a] rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-700 focus:outline-none focus:border-emerald-700/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSaveManualLink}
                  className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[12px] font-semibold transition-colors shrink-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setShowManualLink(false); setManualLinkError('') }}
                  className="px-3 py-2 rounded-lg border border-[#1e2030] text-gray-500 hover:text-gray-300 text-[12px] transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
              {manualLinkError && <p className="text-[11px] text-red-400">{manualLinkError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared types ─────────────────────────────────────────────────────────────
type SAData = { competencies: {type:string;term:string;examples:string[]}[]; goals_objectives: {description:string;outcome:string;reasoning:string}[]; next_year_goals: {goal:string;objective:string}[]; overall_rating: number|null; submitted_at: string|null; drive_url: string|null }

// ─── ComparisonSection ────────────────────────────────────────────────────────

function saDataToText(sa: SAData): string {
  const lines: string[] = []
  if (sa.competencies?.length) {
    lines.push('COMPETENCIES:')
    sa.competencies.forEach(c => {
      lines.push(`[${c.type}] ${c.term}`)
      c.examples?.filter(Boolean).forEach(e => lines.push(`  - ${e}`))
    })
    lines.push('')
  }
  if (sa.goals_objectives?.length) {
    lines.push('GOALS & OUTCOMES:')
    sa.goals_objectives.forEach(g => {
      if (g.description) lines.push(`Goal: ${g.description}`)
      if (g.outcome) lines.push(`Outcome: ${g.outcome}`)
      if (g.reasoning) lines.push(`Reasoning: ${g.reasoning}`)
      lines.push('')
    })
  }
  if (sa.next_year_goals?.length) {
    lines.push("NEXT YEAR'S GOALS:")
    sa.next_year_goals.forEach(g => {
      if (g.goal) lines.push(`Goal: ${g.goal}`)
      if (g.objective) lines.push(`Objective: ${g.objective}`)
      lines.push('')
    })
  }
  if (sa.overall_rating) lines.push(`OVERALL SELF-RATING: ${sa.overall_rating}/5`)
  return lines.join('\n').trim()
}

function ComparisonSection({
  form, savedComparisonReport, onReportSaved, saData,
}: {
  form: FormData
  savedComparisonReport?: string
  onReportSaved?: (report: string) => void
  saData?: SAData | null
}) {
  const [compareStatus, setCompareStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    savedComparisonReport ? 'done' : 'idle'
  )
  const [compareReport, setCompareReport] = useState(savedComparisonReport ?? '')
  const [compareError, setCompareError]   = useState('')
  const [reportCopied, setReportCopied]   = useState(false)
  const [reportEditMode, setReportEditMode] = useState(false)
  const [showManualReport, setShowManualReport] = useState(false)
  const [manualReportValue, setManualReportValue] = useState('')

  function handleSaveManualReport() {
    const val = manualReportValue.trim()
    if (!val) return
    setCompareReport(val)
    setCompareStatus('done')
    setReportEditMode(false)
    setShowManualReport(false)
    setManualReportValue('')
    onReportSaved?.(val)
  }

  async function handleCompare() {
    setCompareStatus('loading')
    setCompareError('')
    setCompareReport('')
    try {
      const employeeText = saData ? saDataToText(saData) : ''
      const res = await fetch('/api/performance-review/compare-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form, employeeText }),
      })
      const data = await res.json() as { report?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Analysis failed')
      const report = data.report ?? ''
      setCompareReport(report)
      setCompareStatus('done')
      setReportEditMode(false)
      onReportSaved?.(report)
    } catch (err) {
      setCompareError(String(err))
      setCompareStatus('error')
    }
  }

  function stripMarkdown(text: string): string {
    return text.replace(/^##\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[-*]\s+/gm, '• ').trim()
  }

  function copyReport() {
    navigator.clipboard.writeText(stripMarkdown(compareReport)).then(() => {
      setReportCopied(true)
      setTimeout(() => setReportCopied(false), 2000)
    })
  }

  function handleReportEdit(val: string) {
    setCompareReport(val)
    onReportSaved?.(val)
  }

  const canGenerate = !!saData && compareStatus !== 'loading'

  return (
    <div className="rounded-xl border border-purple-900/40 bg-purple-950/10 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-purple-200 flex items-center gap-2">
            <FileText size={14} className="text-purple-400" />
            Comparison Report
          </p>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            AI-generated report comparing the self-assessment and performance review — alignment areas, divergence, talking points, and action plan.
          </p>
        </div>
        {!saData && (
          <span className="text-[11px] text-amber-500 bg-amber-950/40 border border-amber-800/40 rounded-lg px-3 py-1.5 shrink-0">
            SA not loaded
          </span>
        )}
        {saData && compareStatus !== 'done' && (
          <span className="text-[11px] text-emerald-500 flex items-center gap-1 shrink-0">
            <CheckCircle2 size={11} /> SA ready
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleCompare}
          disabled={!canGenerate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors"
        >
          {compareStatus === 'loading' ? (
            <><Loader2 size={13} className="animate-spin" /> Analyzing…</>
          ) : compareStatus === 'done' ? (
            <><RefreshCw size={13} /> Regenerate Report</>
          ) : (
            <><Sparkles size={13} /> Generate Comparison Report</>
          )}
        </button>
        {compareStatus === 'done' && !showManualReport && (
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={11} /> Saved to this review
          </span>
        )}
      </div>

      {compareStatus === 'error' && (
        <div className="text-[11px] text-red-400 bg-red-950/30 rounded-lg px-3 py-2">
          <span className="font-semibold">Error: </span>{compareError}
        </div>
      )}

      {!showManualReport ? (
        <button
          type="button"
          onClick={() => { setShowManualReport(true); setManualReportValue(compareStatus === 'done' ? compareReport : '') }}
          className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors underline-offset-2 hover:underline"
        >
          {compareStatus === 'done' ? 'Replace with a manually written report' : 'Already wrote the report? Paste it in directly'}
        </button>
      ) : (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-gray-500">Paste your manually written comparison report:</p>
          <textarea
            value={manualReportValue}
            onChange={e => setManualReportValue(e.target.value)}
            placeholder="Paste your comparison report here…"
            rows={8}
            className="w-full bg-[#0a0c14] border border-[#2a2d3a] rounded-xl px-4 py-3 text-[12px] text-gray-200 placeholder-gray-700 focus:outline-none focus:border-purple-600/60 transition-colors resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveManualReport}
              disabled={!manualReportValue.trim()}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors"
            >
              Save Report
            </button>
            <button
              type="button"
              onClick={() => { setShowManualReport(false); setManualReportValue('') }}
              className="px-3 py-2 rounded-lg border border-[#1e2030] text-gray-500 hover:text-gray-300 text-[12px] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {compareStatus === 'done' && compareReport && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Comparison Report</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setReportEditMode(m => !m)}
                title={reportEditMode ? 'Back to preview' : 'Edit report'}
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                  reportEditMode
                    ? 'border-purple-600 bg-purple-900/30 text-purple-300'
                    : 'border-[#2a2d3a] bg-[#0d0f1a] text-gray-400 hover:text-white hover:border-[#3a3d4a]'
                }`}
              >
                <Pencil size={11} />
                {reportEditMode ? 'Preview' : 'Edit'}
              </button>
              <button
                onClick={copyReport}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2d3a] bg-[#0d0f1a] text-gray-400 hover:text-white hover:border-purple-700/60 transition-all"
              >
                {reportCopied ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {reportCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {reportEditMode ? (
            <textarea
              value={compareReport}
              onChange={e => handleReportEdit(e.target.value)}
              rows={24}
              className="w-full bg-[#0b0d14] border border-purple-800/40 rounded-xl px-5 py-4 text-[12px] text-gray-300 leading-relaxed font-mono focus:outline-none focus:border-purple-600 transition-colors resize-y
                [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-[#2a2d3a]"
            />
          ) : (
            <div className="bg-[#0b0d14] border border-[#1e2030] rounded-xl p-5 space-y-5
              [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-[#2a2d3a]">
              {renderComparisonReport(compareReport)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── StepOutput ───────────────────────────────────────────────────────────────

function StepOutput({
  form, onSubmit,
}: {
  form: FormData
  onSubmit?: () => void
}) {
  const scoreInfo = form.overallScore > 0 ? SCORE_LABELS[form.overallScore] : null

  const compEntries = [
    { entry: form.competencyOne,   ordinal: 'ONE',   typeLabel: 'positive' as const },
    { entry: form.competencyTwo,   ordinal: 'TWO',   typeLabel: 'positive' as const },
    { entry: form.competencyThree, ordinal: 'THREE', typeLabel: 'constructive' as const },
    { entry: form.competencyFour,  ordinal: 'FOUR',  typeLabel: 'constructive' as const },
    { entry: form.competencyFive,  ordinal: 'FIVE',  typeLabel: form.competencyFiveType },
  ]

  const fullReview = buildFullReview(form)

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

      {/* Submit Review button */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onSubmit}
          style={{ padding: '11px 32px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Submit Review →
        </button>
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

function reviewPct(save: SavedReview): number {
  if (save.driveUrl || save.managerSignedAt) return 100
  // No form_data and no drive/signature = genuinely empty (ghost review or corrupt record)
  if (!save.form) return 0
  const filled = Array.from({ length: STEPS.length - 1 }, (_, i) => i).filter(i => isStepComplete(i, save.form)).length
  return Math.round((filled / (STEPS.length - 1)) * 100)
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function PerformanceReviewForm() {
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  const [form, setForm] = useState<FormData>(defaultForm())
  const [saves, setSaves] = useState<SavedReview[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activePage, setActivePage] = useState<'reviews' | 'history' | 'team' | 'guide' | 'glossary' | 'notifications' | 'cycles' | 'meeting' | 'notes' | 'checkins' | 'peer-feedback' | 'pip'>('reviews')
  const [reviewsExpanded, setReviewsExpanded] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showDirectReports, setShowDirectReports] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showManagerGuide, setShowManagerGuide] = useState(false)
  const [showManagerGlossary, setShowManagerGlossary] = useState(false)
  const [glossarySearch, setGlossarySearch] = useState('')
  const [directReports, setDirectReports] = useState<DirectReport[]>([])
  const [selfAssessments, setSelfAssessments] = useState<{ employee_id: string; status: string; submitted_at: string | null }[]>([])
  const selfAssessmentMap = Object.fromEntries(selfAssessments.map(s => [s.employee_id, s]))
  // DB-backed team (from profiles where manager_id = user.id)
  type DbTeamMember = { id: string; name: string | null; email: string; role: string; is_active: boolean; start_date: string | null; position: string | null; division: string | null; pronouns: string | null }
  const [dbTeam, setDbTeam] = useState<DbTeamMember[]>([])
  const [dbTeamSaMap, setDbTeamSaMap] = useState<Record<string, { employee_id: string; status: string; submitted_at: string | null }>>({})
  const [managerGlossarySearch, setManagerGlossarySearch] = useState('')
  const [settings, setSettings] = useState<AppSettings>({ driveFolderUrl: '' })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const reviewIdRef = useRef('')
  const [currentReviewId, setCurrentReviewId] = useState('')
  const [currentEmployeeId, setCurrentEmployeeId] = useState('')
  const [showEmployeePicker, setShowEmployeePicker] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileRole, setProfileRole] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // ── SA viewer ────────────────────────────────────────────────────────────────
  const [viewingSA, setViewingSA] = useState<{employeeId:string;employeeName:string;position:string}|null>(null)
  const [saData, setSAData] = useState<SAData|null>(null)
  const [saLoading, setSALoading] = useState(false)

  // ── Review signatures (for cycles + meeting pages) ───────────────────────────
  const [reviewSignatures, setReviewSignatures] = useState<Record<string, { employee_signed_at: string | null; employee_signature: string | null }>>({})

  // ── Meeting page state ────────────────────────────────────────────────────────
  const [meetingDetailId, setMeetingDetailId] = useState<string | null>(null)
  const [meetingSAData, setMeetingSAData] = useState<SAData | null>(null)
  const [meetingSALoading, setMeetingSALoading] = useState(false)
  const [meetingEmpSigLoading, setMeetingEmpSigLoading] = useState(false)
  const [meetingEmpSigError, setMeetingEmpSigError] = useState('')
  const [meetingEmpSigSuccess, setMeetingEmpSigSuccess] = useState(false)
  const [meetingMgrSigLoading, setMeetingMgrSigLoading] = useState(false)
  const [meetingMgrSigError, setMeetingMgrSigError] = useState('')
  const [meetingDriveStatus, setMeetingDriveStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [meetingDriveError, setMeetingDriveError] = useState('')

  // ── Meeting SA auto-load (component level) ─────────────────────────────────
  async function loadMeetingSA(empId: string) {
    if (!empId) return
    setMeetingSALoading(true)
    setMeetingSAData(null)
    try {
      const res = await fetch(`/api/self-reviews?employeeId=${empId}`)
      const data = await res.json() as { selfReview: SAData | null }
      setMeetingSAData(data.selfReview ?? null)
    } catch {
      setMeetingSAData(null)
    } finally {
      setMeetingSALoading(false)
    }
  }

  useEffect(() => {
    if (activePage !== 'meeting' || !meetingDetailId) return
    const save = saves.find(s => s.id === meetingDetailId)
    if (save?.employeeId) {
      loadMeetingSA(save.employeeId)
    }
    // Reset per-session UI state when opening a detail
    setMeetingEmpSigSuccess(false)
    setMeetingMgrSigLoading(false)
    setMeetingMgrSigError('')
    setMeetingEmpSigLoading(false)
    setMeetingEmpSigError('')
    setMeetingDriveStatus('idle')
    setMeetingDriveError('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingDetailId, activePage])

  async function openSA(employeeId: string, employeeName: string, position: string) {
    setViewingSA({ employeeId, employeeName, position })
    setSAData(null)
    setSALoading(true)
    try {
      const res = await fetch(`/api/self-reviews?employeeId=${employeeId}`)
      const data = await res.json() as { selfReview: SAData | null }
      setSAData(data.selfReview ?? null)
    } catch { setSAData(null) }
    finally { setSALoading(false) }
  }

  // ── API helpers (server-side Supabase with service key — no RLS issues) ─────
  function dbRowToSave(r: Record<string, unknown>): SavedReview {
    return {
      id: r.id as string,
      employeeName: (r.employee_name as string) ?? '',
      employeePosition: (r.employee_position as string) ?? '',
      step: (r.step as number) ?? 0,
      maxStep: (r.max_step as number) ?? 0,
      savedAt: (r.saved_at as string) ?? new Date().toISOString(),
      form: (r.form_data as FormData) ?? null as unknown as FormData,
      driveUrl: (r.drive_url as string) || undefined,
      driveDocId: (r.drive_doc_id as string) || undefined,
      comparisonReport: (r.comparison_report as string) || undefined,
      employeeId: (r.employee_id as string) || undefined,
      managerSignedAt: (r.manager_signed_at as string) || undefined,
      managerSignature: (r.manager_signature as string) || undefined,
    }
  }

  async function apiLoadReviews(): Promise<SavedReview[] | null> {
    try {
      const res = await fetch('/api/reviews')
      if (!res.ok) return null
      const { reviews } = await res.json()
      return (reviews as Record<string, unknown>[]).map(dbRowToSave)
    } catch { return null }
  }

  async function apiSaveReview(save: SavedReview) {
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(save),
      })
    } catch { /* offline — localStorage already written */ }
  }

  async function apiDeleteReview(id: string) {
    try {
      await fetch('/api/reviews', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {}
  }

  async function apiPatchReview(id: string, fields: Record<string, unknown>) {
    try {
      await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      })
    } catch {}
  }

  // Init: load reviews from API (falling back to localStorage) + profile
  useEffect(() => {
    setDirectReports(getReports())
    setSettings(s => ({ ...s, ...getSettings() }))
    ;(async () => {
      // Load profile
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setProfileEmail(user.email ?? '')
          const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
          if (profile) {
            setProfileName((profile as {name:string,role:string}).name ?? '')
            setProfileRole((profile as {name:string,role:string}).role ?? '')
          }
        }
      } catch { /* Supabase not configured */ }

      // Load reviews via API (uses service key server-side)
      try {
        const res = await fetch('/api/reviews')
        if (res.ok) {
          const { reviews: rawRows } = await res.json() as { reviews: Record<string, unknown>[] }
          const remote = rawRows.map(dbRowToSave)
          if (remote.length > 0) {
            // Merge with localStorage: keep non-null local values if DB returned null
            // (e.g. drive_url saved to localStorage but PATCH to DB failed)
            const local = getSaves()
            const localMap = Object.fromEntries(local.map(s => [s.id, s]))
            const merged = remote.map(r => {
              const l = localMap[r.id]
              if (!l) return r
              return {
                ...r,
                employeeName: r.employeeName || l.employeeName,
                employeePosition: r.employeePosition || l.employeePosition,
                driveUrl: r.driveUrl || l.driveUrl,
                driveDocId: r.driveDocId || l.driveDocId,
                comparisonReport: r.comparisonReport || l.comparisonReport,
                managerSignedAt: r.managerSignedAt ?? undefined,
                managerSignature: r.managerSignature ?? undefined,
                form: r.form ?? l.form,
              }
            })
            setSaves(merged)
            localStorage.setItem(SAVES_KEY, JSON.stringify(merged))
          } else {
            setSaves(getSaves())
          }
          // Build review signatures map from raw rows
          const sigMap: Record<string, { employee_signed_at: string | null; employee_signature: string | null }> = {}
          for (const row of rawRows) {
            sigMap[row.id as string] = {
              employee_signed_at: (row.employee_signed_at as string | null) ?? null,
              employee_signature: (row.employee_signature as string | null) ?? null,
            }
          }
          setReviewSignatures(sigMap)
        } else {
          setSaves(getSaves())
        }
      } catch {
        setSaves(getSaves())
      }

      // Load DB-backed team (profiles where manager_id = user.id)
      try {
        const teamRes = await fetch('/api/team')
        if (teamRes.ok) {
          const teamData = await teamRes.json() as {
            reports?: { id: string; name: string | null; email: string; role: string; is_active: boolean; start_date: string | null; position: string | null; division: string | null; pronouns: string | null }[]
            selfAssessments?: { employee_id: string; status: string; submitted_at: string | null }[]
          }
          if (teamData.reports) setDbTeam(teamData.reports)
          if (teamData.selfAssessments) {
            setSelfAssessments(teamData.selfAssessments)
            setDbTeamSaMap(Object.fromEntries(teamData.selfAssessments.map(s => [s.employee_id, s])))
          }
        }
      } catch { /* non-critical */ }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When the manager's profile name/email loads, backfill supervisorName if still empty
  // Also fires when currentReviewId changes (new review created) so reset doesn't clear it
  useEffect(() => {
    const managerIdentity = profileName || profileEmail
    if (managerIdentity) {
      setForm(prev => prev.supervisorName ? prev : { ...prev, supervisorName: managerIdentity })
    }
  }, [profileName, profileEmail, currentReviewId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Low-score alert: notify admin once per review when overall score ≤ 2
  const lowScoreAlertedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!form.overallScore || form.overallScore > 2 || !currentReviewId || !form.employeeName.trim()) return
    const key = `${currentReviewId}-${form.overallScore}`
    if (lowScoreAlertedRef.current.has(key)) return
    lowScoreAlertedRef.current.add(key)
    fetch('/api/reviews/low-score-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceId: currentReviewId,
        employeeName: form.employeeName,
        score: form.overallScore,
        type: 'manager_review',
      }),
    }).catch(() => { /* non-critical */ })
  }, [form.overallScore, currentReviewId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Backfill employee profile fields whenever the employee or team data loads.
  // This fills in fields that were blank when a review was saved before the picker existed.
  useEffect(() => {
    if (!currentEmployeeId || dbTeam.length === 0) return
    const emp = dbTeam.find(r => r.id === currentEmployeeId)
    if (!emp) return
    setForm(prev => ({
      ...prev,
      employeeName:     prev.employeeName     || emp.name || emp.email,
      employeePosition: prev.employeePosition || emp.position || '',
      employeeDivision: prev.employeeDivision || emp.division || '',
      employeePronouns: prev.employeePronouns || emp.pronouns || '',
      appraisalPeriod:  prev.appraisalPeriod  || (emp.start_date ? computeAppraisalPeriod(emp.start_date) : ''),
      reviewDate:       prev.reviewDate       || (emp.start_date ? computeReviewDate(emp.start_date) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })),
      supervisorName:   prev.supervisorName   || profileName || profileEmail || '',
    }))
  }, [currentEmployeeId, dbTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep maxStep as the high-water mark — never goes backward
  useEffect(() => {
    setMaxStep(prev => Math.max(prev, step))
  }, [step])

  // Auto-save 1.5s after any form/step change (only once employee name is entered)
  useEffect(() => {
    if (!form.employeeName.trim()) return
    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      // Preserve driveUrl, driveDocId, comparisonReport from the existing saved record
      // so auto-save never overwrites them with undefined/null
      const existing = getSaves().find(s => s.id === reviewIdRef.current)
      const save: SavedReview = {
        id: reviewIdRef.current,
        employeeName: form.employeeName,
        employeePosition: form.employeePosition,
        step,
        maxStep,
        savedAt: new Date().toISOString(),
        form,
        driveUrl: existing?.driveUrl,
        driveDocId: existing?.driveDocId,
        comparisonReport: existing?.comparisonReport,
        employeeId: existing?.employeeId || (currentEmployeeId || undefined),
        managerSignedAt: existing?.managerSignedAt,
        managerSignature: existing?.managerSignature,
      }
      upsertSave(save)
      setSaves(getSaves())
      // Persist to Supabase via API route
      await apiSaveReview(save)
      setSaveStatus('saved')
    }, 1500)
    return () => clearTimeout(timer)
  }, [form, step, maxStep]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoad(save: SavedReview) {
    reviewIdRef.current = save.id
    setCurrentReviewId(save.id)
    setStep(save.step ?? 0)
    setMaxStep(save.maxStep ?? save.step ?? 0)
    if (save.employeeId) setCurrentEmployeeId(save.employeeId)
    setSaveStatus('saved')

    if (save.form) {
      setForm(save.form)
    } else {
      // form_data is null in local state — fetch it fresh from the server
      setForm({ ...defaultForm(), employeeName: save.employeeName ?? '', employeePosition: save.employeePosition ?? '' })
      try {
        const res = await fetch(`/api/reviews?id=${save.id}`)
        if (res.ok) {
          const { review } = await res.json() as { review: Record<string, unknown> }
          if (review?.form_data) {
            const freshForm = review.form_data as FormData
            setForm(freshForm)
            // Patch the in-memory saves so future loads don't re-fetch
            setSaves(prev => prev.map(s => s.id === save.id ? { ...s, form: freshForm } : s))
          }
        }
      } catch { /* non-critical — user sees empty form */ }
    }
  }

  function handleDelete(id: string) {
    deleteSave(id)
    setSaves(prev => prev.filter(s => s.id !== id))
    apiDeleteReview(id)
  }

  function handleNewReview() {
    const newId = crypto.randomUUID()
    reviewIdRef.current = newId
    setCurrentReviewId(newId)
    setCurrentEmployeeId('')
    setForm(defaultForm())
    setStep(0)
    setMaxStep(0)
    setSaveStatus('idle')
  }

  function handleSaveSettings(s: AppSettings) {
    saveSettings(s)
    setSettings(s)
  }

  function handleDriveSaved(url: string, docId: string) {
    const existing = getSaves()
    const idx = existing.findIndex(s => s.id === reviewIdRef.current)
    if (idx >= 0) {
      existing[idx].driveUrl   = url || undefined
      existing[idx].driveDocId = docId || undefined
      localStorage.setItem(SAVES_KEY, JSON.stringify(existing))
      setSaves(getSaves())
    }
    apiPatchReview(reviewIdRef.current, { drive_url: url || null, drive_doc_id: docId || null })
  }

  function handleManagerSigned(signedAt: string, sig: string) {
    const existing = getSaves()
    const idx = existing.findIndex(s => s.id === reviewIdRef.current)
    if (idx >= 0) {
      existing[idx].managerSignedAt = signedAt
      existing[idx].managerSignature = sig
      localStorage.setItem(SAVES_KEY, JSON.stringify(existing))
      setSaves(getSaves())
    }
  }

  function handleReportSaved(report: string) {
    const existing = getSaves()
    const idx = existing.findIndex(s => s.id === reviewIdRef.current)
    if (idx >= 0) {
      existing[idx].comparisonReport = report || undefined
      localStorage.setItem(SAVES_KEY, JSON.stringify(existing))
      setSaves(getSaves())
    }
    apiPatchReview(reviewIdRef.current, { comparison_report: report || null })
  }

  function handleSaveReport(r: DirectReport) {
    const updated = directReports.some(d => d.id === r.id)
      ? directReports.map(d => d.id === r.id ? r : d)
      : [...directReports, r]
    saveReports(updated)
    setDirectReports(updated)
  }

  function handleDeleteReport(id: string) {
    const updated = directReports.filter(d => d.id !== id)
    saveReports(updated)
    setDirectReports(updated)
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

  // Enter key → Continue / Generate Review (skip when focus is inside a textarea or select)
  // Declared after allContentStepsComplete so it's in scope for the closure.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'SELECT') return
      if (showDirectReports) return
      if (step >= STEPS.length - 1) return
      const isLastContent = step === STEPS.length - 2
      const canGo = isLastContent ? allContentStepsComplete : canProceed()
      if (!canGo) return
      e.preventDefault()
      setStep(s => Math.min(STEPS.length - 1, s + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, showDirectReports, allContentStepsComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const ROLE_COLORS: Record<string, string> = { admin: '#818cf8', manager: '#34d399', employee: '#60a5fa' }

  // ── 1:1 Notes page ─────────────────────────────────────────────────────────
  const [notesEmployeeId, setNotesEmployeeId] = useState<string>('')
  const [notesList, setNotesList] = useState<Array<{ id: string; date: string; note: string; tags: string[] }>>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState('')
  const [newNoteDate, setNewNoteDate] = useState('2026-06-15')
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteTags, setNewNoteTags] = useState<string[]>([])
  const [notesSaving, setNotesSaving] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [editNoteDate, setEditNoteDate] = useState('')
  const [editNoteTags, setEditNoteTags] = useState<string[]>([])

  // ── Recording state ─────────────────────────────────────────────────────────
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null)
  const [recordingStatus, setRecordingStatus] = useState<'idle'|'pending_consent'|'consented'|'recording'|'uploading'|'transcribing'|'complete'>('idle')
  const [recordings, setRecordings] = useState<any[]>([])
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordingTranscript, setRecordingTranscript] = useState<string | null>(null)
  const [recordingSummary, setRecordingSummary] = useState<string | null>(null)
  const [recordingActionItems, setRecordingActionItems] = useState<any[]>([])
  const [recordingPanelOpen, setRecordingPanelOpen] = useState(false)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const NOTE_TAGS = [
    { id: 'recognition', label: 'Recognition', color: '#16a34a', bg: 'rgba(22,163,74,0.15)' },
    { id: 'concern', label: 'Concern', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' },
    { id: 'goal_update', label: 'Goal Update', color: '#2563eb', bg: 'rgba(37,99,235,0.15)' },
    { id: 'general', label: 'General', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  ]

  const fetchNotes = async (empId: string) => {
    if (!empId) return
    setNotesLoading(true)
    setNotesError('')
    try {
      const res = await fetch(`/api/one-on-one-notes?employee_id=${empId}`)
      if (!res.ok) throw new Error('Failed to fetch notes')
      const data = await res.json()
      setNotesList(data.notes || [])
    } catch (e: unknown) {
      setNotesError(e instanceof Error ? e.message : 'Error loading notes')
    } finally {
      setNotesLoading(false)
    }
  }

  // Auto-restore recording session state when employee is selected
  const fetchRecordingState = async (empId: string) => {
    if (!empId) return
    try {
      const res = await fetch(`/api/recordings?employee_id=${empId}`)
      if (!res.ok) return
      const data = await res.json()
      const sessions: any[] = Array.isArray(data) ? data : (data.recordings ?? [])
      // Find the most recent active (non-declined, non-complete) session
      const active = sessions.filter((s: any) => s.status !== 'complete' && s.status !== 'declined').pop()
      if (active) {
        setRecordingSessionId(active.id)
        if (active.manager_consented && active.employee_consented) {
          setRecordingStatus('consented')
        } else if (active.status === 'pending_consent') {
          setRecordingStatus('pending_consent')
        }
        setRecordingPanelOpen(true)
      } else {
        setRecordingSessionId(null)
        setRecordingStatus('idle')
      }
    } catch { /* ignore */ }
  }

  const handleSaveNote = async () => {
    if (!notesEmployeeId || !newNoteText.trim()) return
    setNotesSaving(true)
    try {
      const res = await fetch('/api/one-on-one-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: notesEmployeeId, date: newNoteDate, note: newNoteText.trim(), tags: newNoteTags }),
      })
      if (!res.ok) throw new Error('Failed to save note')
      setNewNoteText('')
      setNewNoteTags([])
      await fetchNotes(notesEmployeeId)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error saving note')
    } finally {
      setNotesSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return
    try {
      await fetch(`/api/one-on-one-notes?id=${noteId}`, { method: 'DELETE' })
      setNotesList(prev => prev.filter(n => n.id !== noteId))
    } catch {
      alert('Error deleting note')
    }
  }

  const handleUpdateNote = async (noteId: string) => {
    try {
      const res = await fetch('/api/one-on-one-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, date: editNoteDate, note: editNoteText.trim(), tags: editNoteTags }),
      })
      if (!res.ok) throw new Error('Failed to update note')
      setEditingNoteId(null)
      await fetchNotes(notesEmployeeId)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error updating note')
    }
  }

  const toggleNewNoteTag = (tagId: string) => {
    setNewNoteTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId])
  }

  const renderNotes = () => {
    const activeEmployees = dbTeam.filter(r => r.is_active)
    return (
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>1:1 Notes</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Track notes and observations from your 1:1 conversations.</p>

        {/* Employee selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Employee</label>
          <select
            value={notesEmployeeId}
            onChange={e => { setNotesEmployeeId(e.target.value); fetchNotes(e.target.value); fetchRecordingState(e.target.value) }}
            style={{ padding: '8px 12px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 8, color: '#e0e7ff', fontSize: 13, minWidth: 240, cursor: 'pointer' }}
          >
            <option value=''>— Choose an employee —</option>
            {activeEmployees.map(r => (
              <option key={r.id} value={r.id}>{r.name} — {r.position}</option>
            ))}
          </select>
        </div>

        {notesEmployeeId && (
          <>
            {/* ── Meeting Recording Panel ── */}
            {(() => {
              const notesEmployee = dbTeam.find(r => r.id === notesEmployeeId)
              const employeeName = notesEmployee?.name ?? 'Employee'

              async function handleRequestConsent() {
                setRecordingError(null)
                try {
                  const res = await fetch('/api/recordings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: notesEmployeeId, meeting_date: new Date().toISOString().split('T')[0], year: new Date().getFullYear(), quarter: Math.ceil((new Date().getMonth() + 1) / 3) }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setRecordingSessionId(data.id ?? data.recording_id ?? null)
                    setRecordingStatus('pending_consent')
                  } else {
                    setRecordingError('Failed to send consent request.')
                  }
                } catch {
                  setRecordingError('Network error sending consent request.')
                }
              }

              async function handleRefreshConsentStatus() {
                if (!notesEmployeeId) return
                try {
                  const res = await fetch(`/api/recordings?employee_id=${notesEmployeeId}`)
                  if (res.ok) {
                    const data = await res.json()
                    const sessions: any[] = Array.isArray(data) ? data : (data.recordings ?? [])
                    setRecordings(sessions)
                    // Find active session: prefer recordingSessionId match, else most recent non-complete
                    const active = recordingSessionId
                      ? sessions.find((s: any) => s.id === recordingSessionId)
                      : sessions.filter((s: any) => s.status !== 'complete' && s.status !== 'declined').pop()
                    if (active) {
                      setRecordingSessionId(active.id)
                      if (active.status === 'declined') {
                        setRecordingStatus('idle')
                      } else if (active.manager_consented && active.employee_consented) {
                        setRecordingStatus('consented')
                      } else if (active.status === 'pending_consent') {
                        setRecordingStatus('pending_consent')
                      }
                    }
                  }
                } catch { /* ignore */ }
              }

              async function handleStartRecording() {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                  const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
                  const chunks: Blob[] = []
                  mr.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data) }
                  mr.onstop = () => handleRecordingStop(chunks)
                  mr.start(1000)
                  setMediaRecorder(mr)
                  setAudioChunks([])
                  setRecordingSeconds(0)
                  setRecordingStatus('recording')
                  recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
                } catch {
                  setRecordingError('Microphone access denied or unavailable.')
                }
              }

              function handleStopRecording() {
                if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
                mediaRecorder?.stop()
              }

              async function handleRecordingStop(chunks: Blob[]) {
                setRecordingStatus('uploading')
                const blob = new Blob(chunks, { type: 'audio/webm' })
                const formData = new FormData()
                formData.append('audio', blob, 'recording.webm')
                formData.append('recording_id', recordingSessionId!)
                try {
                  const res = await fetch('/api/recordings/upload', { method: 'POST', body: formData })
                  if (res.ok) {
                    setRecordingStatus('transcribing')
                    const tres = await fetch('/api/recordings/transcribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ recording_id: recordingSessionId }),
                    })
                    const tdata = await tres.json()
                    if (tres.ok) {
                      setRecordingTranscript(tdata.transcript ?? null)
                      setRecordingSummary(tdata.summary ?? null)
                      setRecordingActionItems(tdata.action_items ?? [])
                      setRecordingStatus('complete')
                    } else {
                      setRecordingError('Transcription failed.')
                      setRecordingStatus('consented')
                    }
                  } else {
                    setRecordingError('Upload failed.')
                    setRecordingStatus('consented')
                  }
                } catch {
                  setRecordingError('Network error during upload.')
                  setRecordingStatus('consented')
                }
              }

              function handleSaveRecordingAsNote() {
                const aiItems = recordingActionItems.map((a: any) => `- [${a.owner ?? '?'}] ${a.item ?? a}`).join('\n')
                setNewNoteText((recordingSummary ?? '') + (aiItems ? '\n\nAction Items:\n' + aiItems : ''))
                setNewNoteTags(['from_recording', 'goal_update'])
              }

              const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

              const sentimentColor = (s: string) => s === 'Positive' ? '#16a34a' : s === 'Negative' || s === 'Needs Attention' ? '#dc2626' : '#d97706'
              const sentimentBg = (s: string) => s === 'Positive' ? 'rgba(22,163,74,0.15)' : s === 'Negative' || s === 'Needs Attention' ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.15)'
              const sentimentFromData = (tdata: any) => tdata?.sentiment ?? 'Neutral'
              // We'll derive sentiment from the transcript data stored in state; approximate from summary if absent
              const sentiment = (recordingActionItems as any)._sentiment ?? 'Neutral'

              return (
                <div style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, marginBottom: 24, overflow: 'hidden' }}>
                  {/* Header toggle */}
                  <button
                    onClick={() => setRecordingPanelOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#e0e7ff' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                      🎙️ Meeting Recording
                      {recordingStatus === 'recording' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                          REC {formatTime(recordingSeconds)}
                        </span>
                      )}
                      {recordingStatus === 'complete' && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>● Complete</span>}
                    </span>
                    <span style={{ fontSize: 16, color: '#6b7280', transform: recordingPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
                  </button>

                  {recordingPanelOpen && (
                    <div style={{ padding: '0 20px 20px' }}>
                      {recordingError && (
                        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
                          {recordingError} <button onClick={() => setRecordingError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                      )}

                      {/* ── idle ── */}
                      {recordingStatus === 'idle' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                          <button
                            onClick={handleRequestConsent}
                            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 8, color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Request Recording Consent
                          </button>
                          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Sends consent emails to you and {employeeName} before recording begins.</p>
                        </div>
                      )}

                      {/* ── pending_consent ── */}
                      {recordingStatus === 'pending_consent' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#e0e7ff' }}>⏳ Awaiting consent from both parties</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)', color: '#34d399', fontSize: 11, fontWeight: 600 }}>You: ✓ Consented</span>
                            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.4)', color: '#fbbf24', fontSize: 11, fontWeight: 600 }}>Employee: ⏳ Pending</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Check your email to confirm your own consent.</p>
                          <button onClick={handleRefreshConsentStatus} style={{ alignSelf: 'flex-start', padding: '6px 14px', background: 'transparent', border: '1px solid #1e2130', borderRadius: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
                            ↻ Refresh Status
                          </button>
                        </div>
                      )}

                      {/* ── consented ── */}
                      {recordingStatus === 'consented' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#34d399', fontWeight: 600 }}>✓ Both parties have consented. Ready to record.</p>
                          <button
                            onClick={handleStartRecording}
                            style={{ alignSelf: 'flex-start', padding: '10px 24px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                          >
                            🔴 Start Recording
                          </button>
                        </div>
                      )}

                      {/* ── recording ── */}
                      {recordingStatus === 'recording' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#f0f2fa', fontVariantNumeric: 'tabular-nums' }}>{formatTime(recordingSeconds)}</span>
                          </div>
                          <button
                            onClick={handleStopRecording}
                            style={{ padding: '9px 20px', background: '#1e2130', color: '#e0e7ff', border: '1px solid #374151', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          >
                            ⏹ Stop Recording
                          </button>
                        </div>
                      )}

                      {/* ── uploading ── */}
                      {recordingStatus === 'uploading' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9ca3af', fontSize: 13 }}>
                          <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Uploading recording…
                        </div>
                      )}

                      {/* ── transcribing ── */}
                      {recordingStatus === 'transcribing' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9ca3af', fontSize: 13 }}>
                            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Transcribing with AI…
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>This may take a minute for longer meetings.</p>
                        </div>
                      )}

                      {/* ── complete ── */}
                      {recordingStatus === 'complete' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Summary */}
                          {recordingSummary && (
                            <div style={{ borderLeft: '3px solid #4f46e5', paddingLeft: 14 }}>
                              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</p>
                              <p style={{ margin: 0, fontSize: 13, color: '#c7d2fe', lineHeight: 1.6 }}>{recordingSummary}</p>
                            </div>
                          )}

                          {/* Action Items */}
                          {recordingActionItems.length > 0 && (
                            <div>
                              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Action Items</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {recordingActionItems.map((a: any, i: number) => (
                                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#e0e7ff', cursor: 'pointer' }}>
                                    <input type='checkbox' style={{ marginTop: 2, accentColor: '#4f46e5' }} />
                                    <span><span style={{ color: '#818cf8', fontWeight: 600 }}>[{a.owner ?? '?'}]</span> {a.item ?? String(a)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sentiment */}
                          {(() => {
                            const s = (recordingActionItems as any)._sentiment ?? 'Neutral'
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sentiment:</span>
                                <span style={{ padding: '2px 10px', borderRadius: 20, background: sentimentBg(s), color: sentimentColor(s), fontSize: 11, fontWeight: 700, border: `1px solid ${sentimentColor(s)}40` }}>{s}</span>
                              </div>
                            )
                          })()}

                          {/* Full Transcript toggle */}
                          {recordingTranscript && (
                            <div>
                              <button onClick={() => setTranscriptExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                                View full transcript {transcriptExpanded ? '▲' : '▼'}
                              </button>
                              {transcriptExpanded && (
                                <pre style={{ marginTop: 8, padding: 12, background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, color: '#9ca3af', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{recordingTranscript}</pre>
                              )}
                            </div>
                          )}

                          {/* Save as note */}
                          <button
                            onClick={handleSaveRecordingAsNote}
                            style={{ alignSelf: 'flex-start', padding: '8px 18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          >
                            📝 Save as 1:1 Note
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Add note form */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#e0e7ff' }}>Add Note</h3>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Date</label>
                  <input
                    type='date'
                    value={newNoteDate}
                    onChange={e => setNewNoteDate(e.target.value)}
                    style={{ padding: '6px 10px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 6, color: '#e0e7ff', fontSize: 13 }}
                  />
                </div>
              </div>
              <textarea
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
                placeholder='Write your note here...'
                rows={4}
                style={{ width: '100%', padding: '10px 12px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, color: '#e0e7ff', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {NOTE_TAGS.map(tag => (
                  <button key={tag.id} onClick={() => toggleNewNoteTag(tag.id)}
                    style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${newNoteTags.includes(tag.id) ? tag.color : '#1e2130'}`, background: newNoteTags.includes(tag.id) ? tag.bg : 'transparent', color: newNoteTags.includes(tag.id) ? tag.color : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {tag.label}
                  </button>
                ))}
              </div>
              <button onClick={handleSaveNote} disabled={!newNoteText.trim() || notesSaving}
                style={{ padding: '8px 20px', background: !newNoteText.trim() || notesSaving ? '#1e2130' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: !newNoteText.trim() || notesSaving ? '#4b5563' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !newNoteText.trim() || notesSaving ? 'not-allowed' : 'pointer' }}>
                {notesSaving ? 'Saving…' : 'Save Note'}
              </button>
            </div>

            {/* Notes feed */}
            {notesLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14 }}>Loading notes…</div>
            ) : notesError ? (
              <div style={{ padding: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>{notesError}</div>
            ) : notesList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14, background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12 }}>
                No notes yet for this employee. Add your first note above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...notesList].reverse().map(note => (
                  <div key={note.id} style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 10, padding: 16 }}>
                    {editingNoteId === note.id ? (
                      <>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                          <input type='date' value={editNoteDate} onChange={e => setEditNoteDate(e.target.value)}
                            style={{ padding: '5px 9px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 6, color: '#e0e7ff', fontSize: 12 }} />
                        </div>
                        <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} rows={3}
                          style={{ width: '100%', padding: '8px 10px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 6, color: '#e0e7ff', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          {NOTE_TAGS.map(tag => (
                            <button key={tag.id} onClick={() => setEditNoteTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                              style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${editNoteTags.includes(tag.id) ? tag.color : '#1e2130'}`, background: editNoteTags.includes(tag.id) ? tag.bg : 'transparent', color: editNoteTags.includes(tag.id) ? tag.color : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              {tag.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleUpdateNote(note.id)} style={{ padding: '6px 16px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingNoteId(null)} style={{ padding: '6px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #1e2130', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{note.date}</span>
                          {note.tags?.map(tagId => {
                            const tag = NOTE_TAGS.find(t => t.id === tagId)
                            return tag ? <span key={tagId} style={{ padding: '2px 8px', borderRadius: 20, background: tag.bg, color: tag.color, fontSize: 10, fontWeight: 700, border: `1px solid ${tag.color}` }}>{tag.label}</span> : null
                          })}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            <button onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.note); setEditNoteDate(note.date); setEditNoteTags(note.tags || []) }}
                              style={{ padding: '4px 12px', background: 'transparent', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDeleteNote(note.id)}
                              style={{ padding: '4px 12px', background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Delete</button>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#d1d5db', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.note}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Check-ins page ──────────────────────────────────────────────────────────
  const [checkinsEmployeeId, setCheckinsEmployeeId] = useState<string>('')
  const [checkinsQuarter, setCheckinsQuarter] = useState<number>(2)
  const [checkinData, setCheckinData] = useState<{
    manager?: { pulse: number; notes: string; goal_progress: string; submitted_at?: string }
    employee?: { pulse: number; notes: string; submitted_at?: string }
  } | null>(null)
  const [checkinsLoading, setCheckinsLoading] = useState(false)
  const [checkinsError, setCheckinsError] = useState('')
  const [managerPulse, setManagerPulse] = useState<number>(0)
  const [managerNotes, setManagerNotes] = useState('')
  const [managerGoalProgress, setManagerGoalProgress] = useState('')
  const [checkinSaving, setCheckinSaving] = useState(false)

  // Peer feedback (360°) state
  const [pf360EmployeeId, setPf360EmployeeId] = useState('')
  const [pf360Data, setPf360Data] = useState<any[]>([])
  const [pf360Loading, setPf360Loading] = useState(false)

  // PIP state
  const [pipPlans, setPipPlans] = useState<any[]>([])
  const [pipLoading, setPipLoading] = useState(false)
  const [pipSelectedEmployee, setPipSelectedEmployee] = useState('')
  const [pipShowCreate, setPipShowCreate] = useState(false)
  const [pipCreateTitle, setPipCreateTitle] = useState('')
  const [pipCreateReason, setPipCreateReason] = useState('')
  const [pipCreateStartDate, setPipCreateStartDate] = useState('')
  const [pipCreateTargetDate, setPipCreateTargetDate] = useState('')
  const [pipCreateMilestones, setPipCreateMilestones] = useState<{text: string; due_date: string; completed: boolean}[]>([{ text: '', due_date: '', completed: false }])
  const [pipCreating, setPipCreating] = useState(false)
  const [pipError, setPipError] = useState('')
  const [pipSelectedId, setPipSelectedId] = useState<string | null>(null)
  const [pipCheckInNote, setPipCheckInNote] = useState('')
  const [pipSaving, setPipSaving] = useState(false)

  const fetchCheckin = async (empId: string, quarter: number) => {
    if (!empId) return
    setCheckinsLoading(true)
    setCheckinsError('')
    try {
      const res = await fetch(`/api/quarterly-checkins?employee_id=${empId}&year=2026&quarter=${quarter}`)
      if (!res.ok) throw new Error('Failed to fetch check-in data')
      const data = await res.json()
      setCheckinData(data)
      if (data.manager) {
        setManagerPulse(data.manager.pulse || 0)
        setManagerNotes(data.manager.notes || '')
        setManagerGoalProgress(data.manager.goal_progress || '')
      } else {
        setManagerPulse(0)
        setManagerNotes('')
        setManagerGoalProgress('')
      }
    } catch (e: unknown) {
      setCheckinsError(e instanceof Error ? e.message : 'Error loading check-in')
    } finally {
      setCheckinsLoading(false)
    }
  }

  const handleSaveCheckin = async (submit: boolean) => {
    if (!checkinsEmployeeId) return
    setCheckinSaving(true)
    try {
      const res = await fetch('/api/quarterly-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: checkinsEmployeeId,
          year: 2026,
          quarter: checkinsQuarter,
          role: 'manager',
          pulse: managerPulse,
          notes: managerNotes,
          goal_progress: managerGoalProgress,
          submitted: submit,
        }),
      })
      if (!res.ok) throw new Error('Failed to save check-in')
      await fetchCheckin(checkinsEmployeeId, checkinsQuarter)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error saving check-in')
    } finally {
      setCheckinSaving(false)
    }
  }

  const renderCheckins = () => {
    const activeEmployees = dbTeam.filter(r => r.is_active)
    const QUARTERS = [1, 2, 3]
    const QUARTER_LABELS: Record<number, string> = { 1: 'Q1 (Jan–Mar)', 2: 'Q2 (Apr–Jun)', 3: 'Q3 (Jul–Sep)' }
    return (
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Quarterly Check-ins</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Track quarterly pulse check-ins for your direct reports — 2026.</p>

        {/* Employee selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Employee</label>
          <select
            value={checkinsEmployeeId}
            onChange={e => { setCheckinsEmployeeId(e.target.value); fetchCheckin(e.target.value, checkinsQuarter) }}
            style={{ padding: '8px 12px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 8, color: '#e0e7ff', fontSize: 13, minWidth: 240, cursor: 'pointer' }}
          >
            <option value=''>— Choose an employee —</option>
            {activeEmployees.map(r => (
              <option key={r.id} value={r.id}>{r.name} — {r.position}</option>
            ))}
          </select>
        </div>

        {checkinsEmployeeId && (
          <>
            {/* Quarter tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1e2130', paddingBottom: 0 }}>
              {QUARTERS.map(q => (
                <button key={q} onClick={() => { setCheckinsQuarter(q); fetchCheckin(checkinsEmployeeId, q) }}
                  style={{ padding: '8px 20px', borderRadius: '8px 8px 0 0', border: '1px solid', borderBottom: checkinsQuarter === q ? '1px solid #0d1117' : '1px solid #1e2130', borderColor: checkinsQuarter === q ? '#1e2130' : '#1e2130', background: checkinsQuarter === q ? '#0d1117' : 'transparent', color: checkinsQuarter === q ? '#e0e7ff' : '#6b7280', fontSize: 13, fontWeight: checkinsQuarter === q ? 700 : 400, cursor: 'pointer', position: 'relative', top: 1 }}>
                  {QUARTER_LABELS[q]}
                </button>
              ))}
            </div>

            {checkinsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14 }}>Loading check-in data…</div>
            ) : checkinsError ? (
              <div style={{ padding: 16, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>{checkinsError}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Manager submission */}
                <div style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e0e7ff' }}>Manager Check-in</h3>
                    {checkinData?.manager?.submitted_at && (
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600, background: 'rgba(52,211,153,0.1)', padding: '3px 8px', borderRadius: 6 }}>
                        Submitted {new Date(checkinData.manager.submitted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Pulse rating */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>Pulse Rating</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setManagerPulse(star)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: star <= managerPulse ? '#f59e0b' : '#374151', padding: 0, lineHeight: 1 }}>
                          ★
                        </button>
                      ))}
                      {managerPulse > 0 && <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center', marginLeft: 4 }}>{managerPulse}/5</span>}
                    </div>
                  </div>

                  {/* Overall notes */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>Overall Notes for This Quarter</label>
                    <textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)} rows={4} placeholder='Share your overall observations for this quarter…'
                      style={{ width: '100%', padding: '9px 11px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, color: '#e0e7ff', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>

                  {/* Goal progress */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>How Are Goals Tracking?</label>
                    <textarea value={managerGoalProgress} onChange={e => setManagerGoalProgress(e.target.value)} rows={3} placeholder='Summarize progress toward this employee&apos;s goals…'
                      style={{ width: '100%', padding: '9px 11px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, color: '#e0e7ff', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => handleSaveCheckin(true)} disabled={checkinSaving || managerPulse === 0}
                      style={{ padding: '8px 18px', background: managerPulse === 0 || checkinSaving ? '#1e2130' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: managerPulse === 0 || checkinSaving ? '#4b5563' : 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: managerPulse === 0 || checkinSaving ? 'not-allowed' : 'pointer' }}>
                      {checkinSaving ? 'Saving…' : checkinData?.manager?.submitted_at ? 'Update Submission' : 'Submit'}
                    </button>
                    <button onClick={() => handleSaveCheckin(false)} disabled={checkinSaving}
                      style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #1e2130', borderRadius: 8, fontSize: 12, cursor: checkinSaving ? 'not-allowed' : 'pointer' }}>
                      Save Draft
                    </button>
                  </div>
                </div>

                {/* Employee section (read-only) */}
                <div style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e0e7ff' }}>Employee Check-in</h3>
                    {checkinData?.employee?.submitted_at ? (
                      <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600, background: 'rgba(52,211,153,0.1)', padding: '3px 8px', borderRadius: 6 }}>
                        Submitted {new Date(checkinData.employee.submitted_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: 6 }}>Awaiting</span>
                    )}
                  </div>

                  {checkinData?.employee ? (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>Pulse Rating</label>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} style={{ fontSize: 20, color: star <= (checkinData.employee?.pulse || 0) ? '#f59e0b' : '#374151' }}>★</span>
                          ))}
                          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>{checkinData.employee.pulse}/5</span>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>Employee Notes</label>
                        <p style={{ margin: 0, fontSize: 13, color: '#d1d5db', lineHeight: 1.6, background: '#13151f', padding: '10px 12px', borderRadius: 8, border: '1px solid #1e2130', whiteSpace: 'pre-wrap' }}>
                          {checkinData.employee.notes || 'No notes provided.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, color: '#4b5563', fontSize: 13, gap: 8 }}>
                      <span style={{ fontSize: 28 }}>⏳</span>
                      <span>Awaiting employee check-in for {QUARTER_LABELS[checkinsQuarter]}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const fetchPipPlans = async (empId?: string) => {
    setPipLoading(true)
    try {
      const url = empId ? `/api/pip-plans?employee_id=${empId}` : '/api/pip-plans'
      const res = await fetch(url)
      const data = await res.json()
      setPipPlans(data.data || [])
    } catch { /* ignore */ } finally {
      setPipLoading(false)
    }
  }

  const createPip = async () => {
    if (!pipSelectedEmployee || !pipCreateTitle || !pipCreateStartDate || !pipCreateTargetDate) {
      setPipError('Please fill in all required fields.')
      return
    }
    setPipCreating(true)
    setPipError('')
    try {
      const res = await fetch('/api/pip-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: pipSelectedEmployee,
          title: pipCreateTitle,
          reason: pipCreateReason,
          start_date: pipCreateStartDate,
          target_date: pipCreateTargetDate,
          milestones: pipCreateMilestones.filter(m => m.text),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPipPlans(prev => [data.data, ...prev])
      setPipShowCreate(false)
      setPipCreateTitle(''); setPipCreateReason(''); setPipCreateStartDate(''); setPipCreateTargetDate('')
      setPipCreateMilestones([{ text: '', due_date: '', completed: false }])
      setPipSelectedId(data.data.id)
    } catch (e: any) {
      setPipError(e.message || 'Failed to create PIP')
    } finally {
      setPipCreating(false)
    }
  }

  const updatePip = async (id: string, updates: any) => {
    setPipSaving(true)
    try {
      const res = await fetch('/api/pip-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPipPlans(prev => prev.map(p => p.id === id ? data.data : p))
    } catch { /* ignore */ } finally {
      setPipSaving(false)
    }
  }

  const renderPip = () => {
    const activeEmployees = dbTeam.filter(r => r.is_active)
    const sCard: React.CSSProperties = { background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }
    const inp2: React.CSSProperties = { width: '100%', background: '#0d0f1a', border: '1px solid #1e2130', borderRadius: 8, padding: '8px 12px', color: '#e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
    const lbl2: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }
    const selectedPip = pipPlans.find(p => p.id === pipSelectedId)

    const statusColor: Record<string, string> = { active: '#f59e0b', completed: '#34d399', escalated: '#f87171', withdrawn: '#6b7280' }
    const statusBg: Record<string, string> = { active: '#1f1a0d', completed: '#0d2b1f', escalated: '#2b0d0d', withdrawn: '#13151f' }

    return (
      <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>PIP / Coaching Plans</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Create and manage performance improvement plans for your direct reports.</p>
          </div>
          <button onClick={() => { setPipShowCreate(true); setPipSelectedId(null); fetchPipPlans() }}
            style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New PIP
          </button>
        </div>

        {/* Create form */}
        {pipShowCreate && (
          <div style={{ ...sCard, border: '1px solid rgba(79,70,229,0.4)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2fa', marginBottom: 16 }}>Create New PIP</div>
            {pipError && <div style={{ background: '#2b0d0d', border: '1px solid #f87171', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 12, marginBottom: 12 }}>{pipError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl2}>Employee *</label>
                <select value={pipSelectedEmployee} onChange={e => setPipSelectedEmployee(e.target.value)} style={{ ...inp2 }}>
                  <option value="">Select employee…</option>
                  {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name || e.email}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl2}>Plan Title *</label>
                <input value={pipCreateTitle} onChange={e => setPipCreateTitle(e.target.value)} placeholder="e.g. Performance Improvement Plan Q3" style={inp2} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl2}>Reason / Background</label>
              <textarea value={pipCreateReason} onChange={e => setPipCreateReason(e.target.value)} placeholder="Describe the performance concerns and context…" rows={3}
                style={{ ...inp2, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={lbl2}>Start Date *</label>
                <input type="date" value={pipCreateStartDate} onChange={e => setPipCreateStartDate(e.target.value)} style={inp2} />
              </div>
              <div>
                <label style={lbl2}>Target Completion Date *</label>
                <input type="date" value={pipCreateTargetDate} onChange={e => setPipCreateTargetDate(e.target.value)} style={inp2} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={lbl2}>Milestones</label>
                <button onClick={() => setPipCreateMilestones(prev => [...prev, { text: '', due_date: '', completed: false }])}
                  style={{ fontSize: 11, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add Milestone</button>
              </div>
              {pipCreateMilestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input value={m.text} onChange={e => setPipCreateMilestones(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                    placeholder={`Milestone ${i + 1}`} style={{ ...inp2, flex: 2 }} />
                  <input type="date" value={m.due_date} onChange={e => setPipCreateMilestones(prev => prev.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))}
                    style={{ ...inp2, flex: 1 }} />
                  {pipCreateMilestones.length > 1 && (
                    <button onClick={() => setPipCreateMilestones(prev => prev.filter((_, j) => j !== i))}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createPip} disabled={pipCreating}
                style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pipCreating ? 0.6 : 1 }}>
                {pipCreating ? 'Creating…' : 'Create PIP'}
              </button>
              <button onClick={() => { setPipShowCreate(false); setPipError('') }}
                style={{ padding: '8px 16px', background: 'transparent', color: '#6b7280', border: '1px solid #1e2130', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'flex-start' }}>
          {/* PIP list */}
          <div>
            {pipLoading ? (
              <div style={{ color: '#6b7280', fontSize: 13, padding: 16 }}>Loading…</div>
            ) : pipPlans.length === 0 ? (
              <div style={{ ...sCard, textAlign: 'center', color: '#6b7280', fontSize: 13, padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                No PIPs yet.<br />Click <strong>+ New PIP</strong> to create one.
              </div>
            ) : (
              pipPlans.map(pip => {
                const emp = pip.employee as { name: string | null; email: string } | null
                const isSelected = pip.id === pipSelectedId
                return (
                  <div key={pip.id} onClick={() => setPipSelectedId(pip.id)}
                    style={{ ...sCard, cursor: 'pointer', border: isSelected ? '1px solid rgba(79,70,229,0.5)' : '1px solid #1e2130', background: isSelected ? '#1a1c2e' : '#13151f', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2fa', marginBottom: 4 }}>{pip.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{emp?.name || emp?.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusBg[pip.status] || '#13151f', color: statusColor[pip.status] || '#6b7280' }}>
                        {pip.status.charAt(0).toUpperCase() + pip.status.slice(1)}
                      </span>
                      <span style={{ fontSize: 11, color: '#4b5563' }}>Due {new Date(pip.target_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* PIP detail */}
          {selectedPip ? (
            <div>
              <div style={sCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2fa', marginBottom: 4 }}>{selectedPip.title}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {(selectedPip.employee as any)?.name || (selectedPip.employee as any)?.email} · Started {new Date(selectedPip.start_date).toLocaleDateString()} · Due {new Date(selectedPip.target_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {selectedPip.status === 'active' && (
                      <>
                        <button onClick={() => updatePip(selectedPip.id, { status: 'completed', outcome: 'Goals met' })}
                          style={{ padding: '5px 12px', background: '#0d2b1f', color: '#34d399', border: '1px solid #1a4a35', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ✓ Complete
                        </button>
                        <button onClick={() => updatePip(selectedPip.id, { status: 'escalated' })}
                          style={{ padding: '5px 12px', background: '#2b0d0d', color: '#f87171', border: '1px solid #5c2020', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ↑ Escalate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {selectedPip.reason && (
                  <div style={{ background: '#0d0f1a', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                    {selectedPip.reason}
                  </div>
                )}

                {/* Milestones */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Milestones</div>
                  {(selectedPip.milestones as any[]).length === 0 ? (
                    <div style={{ fontSize: 13, color: '#4b5563' }}>No milestones set.</div>
                  ) : (
                    (selectedPip.milestones as any[]).map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1e2130' }}>
                        <input type="checkbox" checked={m.completed} onChange={() => {
                          const updated = (selectedPip.milestones as any[]).map((x, j) => j === i ? { ...x, completed: !x.completed } : x)
                          updatePip(selectedPip.id, { milestones: updated })
                        }} style={{ accentColor: '#4f46e5', width: 14, height: 14, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, color: m.completed ? '#4b5563' : '#e5e7eb', textDecoration: m.completed ? 'line-through' : 'none' }}>{m.text}</span>
                        {m.due_date && <span style={{ fontSize: 11, color: '#4b5563' }}>{new Date(m.due_date).toLocaleDateString()}</span>}
                      </div>
                    ))
                  )}
                </div>

                {/* Check-in notes */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Check-in Log</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={pipCheckInNote} onChange={e => setPipCheckInNote(e.target.value)}
                      placeholder="Add a check-in note…" style={{ ...inp2, flex: 1 }} />
                    <button disabled={!pipCheckInNote || pipSaving} onClick={() => {
                      const notes = [...((selectedPip.check_in_notes as any[]) || []), { text: pipCheckInNote, date: new Date().toISOString() }]
                      updatePip(selectedPip.id, { check_in_notes: notes })
                      setPipCheckInNote('')
                    }} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !pipCheckInNote || pipSaving ? 0.5 : 1 }}>
                      Add
                    </button>
                  </div>
                  {((selectedPip.check_in_notes as any[]) || []).length === 0 ? (
                    <div style={{ fontSize: 13, color: '#4b5563' }}>No check-in notes yet.</div>
                  ) : (
                    [...((selectedPip.check_in_notes as any[]) || [])].reverse().map((n, i) => (
                      <div key={i} style={{ background: '#0d0f1a', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, color: '#e5e7eb', lineHeight: 1.6 }}>{n.text}</div>
                        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>{new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : !pipShowCreate && (
            <div style={{ ...sCard, textAlign: 'center', color: '#6b7280', fontSize: 13, padding: 48 }}>
              Select a PIP from the list to view details.
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderPeerFeedback = () => {
    const activeEmployees = dbTeam.filter(r => r.is_active)
    const selectedEmp = activeEmployees.find(r => r.id === pf360EmployeeId)
    const avgRating = pf360Data.length > 0
      ? (pf360Data.reduce((sum, item) => sum + (item.q3_collab_rating || 0), 0) / pf360Data.length).toFixed(1)
      : null

    return (
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Peer Reviews (360°)</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Aggregated peer feedback submitted for your direct reports.</p>

        {/* Employee selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Employee</label>
          <select
            value={pf360EmployeeId}
            onChange={async e => {
              const empId = e.target.value
              setPf360EmployeeId(empId)
              setPf360Data([])
              if (!empId) return
              setPf360Loading(true)
              try {
                const res = await fetch(`/api/peer-feedback?requestor_id=${empId}&year=2026`)
                if (res.ok) {
                  const json = await res.json()
                  setPf360Data(Array.isArray(json) ? json : (json.data ?? []))
                }
              } catch { /* offline */ }
              setPf360Loading(false)
            }}
            style={{ padding: '8px 12px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 8, color: '#e0e7ff', fontSize: 13, minWidth: 240, cursor: 'pointer' }}
          >
            <option value=''>— Choose an employee —</option>
            {activeEmployees.map(r => (
              <option key={r.id} value={r.id}>{r.name} — {r.position}</option>
            ))}
          </select>
        </div>

        {pf360EmployeeId && (
          pf360Loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14 }}>Loading peer feedback…</div>
          ) : pf360Data.length === 0 ? (
            <div style={{ padding: '32px 24px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>No peer feedback submitted for <strong style={{ color: '#e0e7ff' }}>{selectedEmp?.name || 'this employee'}</strong> yet.</p>
            </div>
          ) : (
            <>
              {/* Aggregate summary */}
              <div style={{ marginBottom: 24, padding: '16px 20px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Submissions</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e0e7ff' }}>{pf360Data.length} review{pf360Data.length !== 1 ? 's' : ''}</div>
                </div>
                {avgRating !== null && (
                  <div style={{ borderLeft: '1px solid #1e2130', paddingLeft: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Avg Collaboration Rating</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{avgRating} / 5.0 ★</div>
                  </div>
                )}
              </div>

              {/* Individual feedback cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pf360Data.map((item, idx) => {
                  const reviewerName = item.is_anonymous ? 'Anonymous Reviewer' : (item.reviewer_name || item.reviewer_email || 'Unknown')
                  return (
                    <div key={idx} style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, padding: 20 }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: item.is_anonymous ? '#1e2130' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {item.is_anonymous ? '?' : reviewerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e7ff' }}>{reviewerName}</div>
                          {item.submitted_at && <div style={{ fontSize: 11, color: '#6b7280' }}>Submitted {new Date(item.submitted_at).toLocaleDateString()}</div>}
                        </div>
                        {item.q3_collab_rating > 0 && (
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {[1,2,3,4,5].map(s => (
                              <span key={s} style={{ fontSize: 16, color: s <= item.q3_collab_rating ? '#f59e0b' : '#374151' }}>★</span>
                            ))}
                            <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{item.q3_collab_rating}/5</span>
                          </div>
                        )}
                      </div>

                      {/* Fields */}
                      {item.q1_strengths && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Strengths</div>
                          <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, background: '#13151f', borderRadius: 8, padding: '10px 12px' }}>{item.q1_strengths}</div>
                        </div>
                      )}

                      {item.q2_improvements && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Areas for Growth</div>
                          <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, background: '#13151f', borderRadius: 8, padding: '10px 12px' }}>{item.q2_improvements}</div>
                        </div>
                      )}

                      {item.q3_collab_text && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Collaboration Notes</div>
                          <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, background: '#13151f', borderRadius: 8, padding: '10px 12px' }}>{item.q3_collab_text}</div>
                        </div>
                      )}

                      {item.additional_comments && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Additional Comments</div>
                          <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, background: '#13151f', borderRadius: 8, padding: '10px 12px' }}>{item.additional_comments}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b0d14', color: 'white', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Overlay panels */}
      {showSettings && <SettingsPanel settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
      {showDirectReports && <DirectReportsPanel reports={directReports} onSave={handleSaveReport} onDelete={handleDeleteReport} onClose={() => setShowDirectReports(false)} />}

      {/* Manager Guide panel */}
      {showManagerGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowManagerGuide(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 500, background: '#0b0d14', borderLeft: '1px solid #1e2030', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e2030', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={14} className="text-purple-400" style={{ color: '#c084fc' }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f2fa' }}>Manager&apos;s Guide to Performance Reviews</span>
              </div>
              <button onClick={() => setShowManagerGuide(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontSize: 13, lineHeight: 1.7 }}>

              <p style={{ color: '#9ca3af', marginTop: 0 }}>
                Performance reviews are a critical tool for aligning employee performance with organizational goals, personal and professional development, and building a culture of continuous improvement. Your role is to ensure reviews are fair, constructive, and future-focused.
              </p>

              {[
                {
                  title: 'Preparation',
                  color: '#c084fc',
                  content: 'Review performance metrics (job descriptions, KPIs, project completion rates, attendance). Gather 360-degree feedback from colleagues and key stakeholders. Review the employee\'s self-assessment to understand their perspective before the evaluation discussion.',
                },
                {
                  title: 'Components of an Evaluation',
                  color: '#c084fc',
                  content: 'The evaluation includes a 5-word competency review, evaluation of successful or unsuccessful completion of goals and objectives, and accomplishments made during the relevant review period. Reflect on previous reviews to determine progress on past goals and identify potential recurring issues.',
                },
                {
                  title: 'Tips for the Discussion',
                  color: '#c084fc',
                  content: '• Recognize strengths genuinely — highlight how they contribute positively to the team.\n• Don\'t sugar-coat underperformance — address missed goals with specific examples.\n• Frame tough conversations as growth opportunities, not criticism.\n• Be empathetic — listen to the employee\'s perspective and challenges.\n• Identify skills gaps and be clear on what success looks like for each goal.\n• If an employee disagrees, express rationale calmly, acknowledge their viewpoint, and focus on an action plan.',
                },
                {
                  title: '⚠️ Important Note',
                  color: '#f87171',
                  content: 'One and Two-star ratings MUST ALWAYS have a consultation with Human Resources before the evaluation discussion.',
                },
              ].map(s => (
                <div key={s.title} style={{ marginBottom: 14, padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2030' }}>
                  <div style={{ fontWeight: 700, color: s.color, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.content}</div>
                </div>
              ))}

              {/* Star Matrix */}
              <div style={{ marginBottom: 14, padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2030' }}>
                <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Rush Media Star Rating Matrix</div>
                {[
                  [5, '#a78bfa', 'Outstanding', 'Consistently exceeds performance requirements.'],
                  [4, '#34d399', 'Exceeds Job Requirements', 'Meets and at times exceeds performance requirements (above average).'],
                  [3, '#fbbf24', 'Meets Expectations', 'Job requirements are being met at a satisfactory level.'],
                  [2, '#fb923c', 'Needs Improvement', 'Does not consistently meet the expected job requirements.'],
                  [1, '#f87171', 'Unsatisfactory', 'Demonstrates an unacceptable level of skills and competencies.'],
                ].map(([n, color, label, desc]) => (
                  <div key={String(n)} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 15, color: color as string, fontWeight: 800, minWidth: 20 }}>{n}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: color as string }}>{label as string}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{desc as string}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* SMART Goals */}
              <div style={{ marginBottom: 14, padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2030' }}>
                <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>SMART Goal Method</div>
                {[
                  ['S', 'Specific', 'Goals should be specific and narrow enough for effective planning and attainability.'],
                  ['M', 'Measurable', 'Define how progress towards the goal will be made.'],
                  ['A', 'Attainable', 'Ensure goals are accomplished reasonably within a certain timeframe.'],
                  ['R', 'Relevant', 'Goals should align with Company values and the employee\'s job description.'],
                  ['T', 'Time-Bound', 'Set a realistic date and stick to it.'],
                ].map(([letter, word, desc]) => (
                  <div key={letter} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: '#818cf8', fontSize: 15, minWidth: 16 }}>{letter}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#c4c9d4' }}>{word}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Goals vs Objectives */}
              <div style={{ marginBottom: 14, padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2030' }}>
                <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Goals vs. Objectives vs. Accomplishments</div>
                {[
                  { title: 'Goal', color: '#818cf8', desc: 'Broad, longer-term, achievable outcomes agreed upon by the employee and manager as a plan of action for the following review cycle.', example: 'Improve public speaking skills.' },
                  { title: 'Objective', color: '#34d399', desc: 'Shorter, more specific, measurable steps toward achieving a goal. Generally determined by the employee with manager support.', example: 'Attend a public speaking course and practice presentations to a colleague one time per quarter.' },
                  { title: 'Accomplishment', color: '#fbbf24', desc: 'Tangible achievements or milestones as a result of pursuing goals and objectives.', example: 'Successfully delivered a confident presentation at a Company-wide meeting that received positive feedback from senior management.' },
                ].map(item => (
                  <div key={item.title} style={{ marginBottom: 12, padding: '10px 12px', background: '#0d0f1a', borderRadius: 8, borderLeft: `3px solid ${item.color}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginBottom: 6 }}>{item.desc}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Example: {item.example}</div>
                  </div>
                ))}
              </div>

              {/* Things to consider */}
              <div style={{ padding: '14px 16px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2030' }}>
                <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Questions to Consider</div>
                {[
                  'How does your employee perform on the team?',
                  'Does their performance limit the success of colleagues or help them?',
                  'Is/has the employee been transparent and efficient?',
                  'What is one small thing your employee could change that would have the biggest impact?',
                  'Where have they made the most progress?',
                  'Where have they had the most impact on others?',
                  'Alignment — Are they spending the right time on the right work?',
                  'Balance — What are they good at? What could they improve? What have they accomplished?',
                  'Communication — Do they have the information and resources needed to grow?',
                ].map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e2030', fontSize: 12, color: '#9ca3af' }}>
                    <span style={{ color: '#818cf8', fontSize: 10, marginTop: 3, flexShrink: 0 }}>▸</span> {q}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Competency Glossary panel */}
      {showManagerGlossary && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowManagerGlossary(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 500, background: '#0b0d14', borderLeft: '1px solid #1e2030', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e2030', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookMarked size={14} style={{ color: '#c084fc' }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f2fa' }}>Competency Glossary of Terms</span>
              </div>
              <button onClick={() => setShowManagerGlossary(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2030', flexShrink: 0 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>
                Use these definitions when selecting competency words for Part One of the review.
              </p>
              <input
                value={glossarySearch}
                onChange={e => setGlossarySearch(e.target.value)}
                placeholder="Search competencies…"
                style={{ width: '100%', background: '#13151f', border: '1px solid #2a2d3a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e5e7eb', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {COMPETENCIES
                .filter(c =>
                  c.name.toLowerCase().includes(glossarySearch.toLowerCase()) ||
                  c.definition.toLowerCase().includes(glossarySearch.toLowerCase())
                )
                .map(c => (
                  <div key={c.name} style={{ marginBottom: 10, padding: '12px 14px', background: '#13151f', borderRadius: 10, border: '1px solid #1e2030' }}>
                    <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 13, marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>{c.definition}</div>
                  </div>
                ))
              }
              {COMPETENCIES.filter(c =>
                c.name.toLowerCase().includes(glossarySearch.toLowerCase()) ||
                c.definition.toLowerCase().includes(glossarySearch.toLowerCase())
              ).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#374151', fontSize: 13 }}>No results found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowProfile(false) }}>
          <div className="bg-[#13151f] border border-[#1e2130] rounded-2xl p-8 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-100">My Profile</h2>
              <button onClick={() => setShowProfile(false)} className="text-gray-500 hover:text-gray-200"><X size={18} /></button>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white mb-5 mx-auto">
              {(profileName || profileEmail).charAt(0).toUpperCase()}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Display name</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)}
                  className="w-full bg-[#0d0f1a] border border-[#2a2d3e] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-600" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Email</label>
                <div className="w-full bg-[#0d0f1a] border border-[#1e2130] rounded-lg px-3 py-2 text-sm text-gray-500">{profileEmail || '—'}</div>
              </div>
              {profileRole && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Role</label>
                  <div className="w-full bg-[#0d0f1a] border border-[#1e2130] rounded-lg px-3 py-2 text-sm" style={{ color: ROLE_COLORS[profileRole] || '#9ca3af' }}>
                    {profileRole.charAt(0).toUpperCase() + profileRole.slice(1)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProfile(false)} className="flex-1 py-2 text-sm text-gray-500 border border-[#2a2d3e] rounded-lg hover:text-gray-200 transition-colors">Cancel</button>
              <button
                disabled={profileSaving}
                onClick={async () => {
                  setProfileSaving(true)
                  try {
                    const { createClient } = await import('@/lib/supabase/client')
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) await supabase.from('profiles').update({ name: profileName }).eq('id', user.id)
                  } catch { /* offline */ }
                  setProfileSaving(false)
                  setShowProfile(false)
                }}
                className="flex-1 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >{profileSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarCollapsed ? 56 : 240,
        flexShrink: 0,
        background: '#0d0f1a',
        borderRight: '1px solid #1e2130',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Logo row + collapse toggle */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: sidebarCollapsed ? '0 12px' : '0 16px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#f0f2fa', whiteSpace: 'nowrap' }}>Performance Review</span>
            </div>
          )}
          {sidebarCollapsed && <span style={{ fontSize: 18 }}>📋</span>}
          <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* New Review button */}
        <div style={{ padding: sidebarCollapsed ? '12px 8px' : '12px 12px', flexShrink: 0 }}>
          <button onClick={() => setShowEmployeePicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 8, padding: sidebarCollapsed ? '8px' : '8px 12px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }} title={sidebarCollapsed ? 'New Review' : undefined}>
            <Plus size={14} />
            {!sidebarCollapsed && 'New Review'}
          </button>
        </div>

        {/* ── Nav items ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!sidebarCollapsed && <div style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px 6px' }}>Menu</div>}

          {/* Performance Reviews nav item — dropdown */}
          {(() => {
            const active = activePage === 'reviews'
            const inProgressSaves = saves.filter(save => { const p = reviewPct(save); return p > 0 && p < 100 })
            return (
              <div style={{ marginBottom: 2 }}>
                {/* Row: clicking icon/label sets page, clicking chevron toggles dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent' }}
                  onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                  onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                  <button
                    onClick={() => { setActivePage('reviews'); if (!reviewsExpanded) setReviewsExpanded(true) }}
                    title={sidebarCollapsed ? 'Performance Reviews' : undefined}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', background: 'none', border: 'none', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
                    <FileText size={15} color={active ? '#818cf8' : '#6b7280'} />
                    {!sidebarCollapsed && 'Performance Reviews'}
                    {!sidebarCollapsed && inProgressSaves.length > 0 && (
                      <span style={{ marginLeft: 4, background: '#4f46e5', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px' }}>{inProgressSaves.length}</span>
                    )}
                  </button>
                  {/* Chevron toggle — only when not collapsed */}
                  {!sidebarCollapsed && (
                    <button onClick={e => { e.stopPropagation(); setReviewsExpanded(v => !v) }}
                      style={{ padding: '8px 8px 8px 0', background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronRight size={13} style={{ transform: reviewsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                    </button>
                  )}
                </div>
                {/* In-progress review sub-list */}
                {reviewsExpanded && !sidebarCollapsed && (
                  <div style={{ marginTop: 2, marginBottom: 2 }}>
                    {inProgressSaves.map(save => {
                      const isActive = save.id === currentReviewId
                      const pct = reviewPct(save)
                      const isConfirming = confirmDeleteId === save.id
                      return (
                        <div key={save.id} className="group"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 24px', borderRadius: 8, marginBottom: 1, background: isActive ? '#1e1f3a' : 'transparent', border: isActive ? '1px solid rgba(79,70,229,0.2)' : '1px solid transparent' }}
                          onMouseOver={e => { if (!isActive && !isConfirming) e.currentTarget.style.background = '#13151f' }}
                          onMouseOut={e => { if (!isActive && !isConfirming) e.currentTarget.style.background = 'transparent' }}>
                          {/* Main clickable area */}
                          <div onClick={() => { if (!isConfirming) { handleLoad(save); setActivePage('reviews') } }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: isConfirming ? 'default' : 'pointer' }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: isActive ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#1e2130', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isActive ? 'white' : '#6b7280' }}>
                              {save.employeeName?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#e0e7ff' : '#c4c9d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{save.employeeName || 'Untitled'}</div>
                              <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{pct}% complete</div>
                            </div>
                          </div>
                          {/* Delete controls */}
                          {isConfirming ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); handleDelete(save.id); if (save.id === currentReviewId) { setCurrentReviewId(''); setForm(defaultForm()) }; setConfirmDeleteId(null) }}
                                style={{ fontSize: 10, padding: '2px 6px', background: '#5c2020', color: '#f87171', border: '1px solid #7c2020', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                Yes
                              </button>
                              <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 4, cursor: 'pointer' }}>
                                No
                              </button>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(save.id) }}
                              title="Delete review"
                              style={{ padding: '3px', background: 'transparent', border: 'none', color: '#4b5563', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#4b5563' }}>
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {inProgressSaves.length === 0 && (
                      <div style={{ padding: '6px 8px 6px 24px', fontSize: 11, color: '#374151', lineHeight: 1.5 }}>No active reviews.<br />Create one above.</div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* History */}
          {(() => {
            const active = activePage === 'history'
            return (
              <button onClick={() => setActivePage('history')} title={sidebarCollapsed ? 'History' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <History size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'History'}
              </button>
            )
          })()}

          {/* Team */}
          {(() => {
            const active = activePage === 'team'
            const pending = dbTeam.filter(r => dbTeamSaMap[r.id]?.status === 'submitted').length
            return (
              <button onClick={() => setActivePage('team')} title={sidebarCollapsed ? 'Team' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <Users size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'Team'}
                {pending > 0 && !sidebarCollapsed && <span style={{ marginLeft: 'auto', background: '#4f46e5', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px' }}>{pending}</span>}
              </button>
            )
          })()}

          {/* Manager Guide */}
          {(() => {
            const active = activePage === 'guide'
            return (
              <button onClick={() => setActivePage('guide')} title={sidebarCollapsed ? 'Manager Guide' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <BookOpen size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'Manager Guide'}
              </button>
            )
          })()}

          {/* Competency Glossary */}
          {(() => {
            const active = activePage === 'glossary'
            return (
              <button onClick={() => setActivePage('glossary')} title={sidebarCollapsed ? 'Competency Glossary' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <BookMarked size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'Competency Glossary'}
              </button>
            )
          })()}

          {/* Notifications */}
          {(() => {
            const active = activePage === 'notifications'
            const notifCount = saves.filter(s => { const p = reviewPct(s); return p > 0 && p < 100 }).length
            return (
              <button onClick={() => setActivePage('notifications')} title={sidebarCollapsed ? 'Notifications' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <Bell size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'Notifications'}
                {notifCount > 0 && !sidebarCollapsed && <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#0d0f1a', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px' }}>{notifCount}</span>}
              </button>
            )
          })()}

          {/* Review Cycles */}
          {(() => {
            const active = activePage === 'cycles'
            return (
              <button onClick={() => setActivePage('cycles')} title={sidebarCollapsed ? 'Review Cycles' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <RefreshCw size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'Review Cycles'}
              </button>
            )
          })()}

          {/* Annual Reviews */}
          {(() => {
            const active = activePage === 'meeting'
            const signedSaves = saves.filter(s => s.managerSignedAt)
            return (
              <button onClick={() => { setMeetingDetailId(null); setActivePage('meeting') }} title={sidebarCollapsed ? 'Annual Reviews' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <Users size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!sidebarCollapsed && 'Annual Reviews'}
                {signedSaves.length > 0 && !sidebarCollapsed && <span style={{ marginLeft: 'auto', background: '#34d399', color: '#0d0f1a', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px' }}>{signedSaves.length}</span>}
              </button>
            )
          })()}

          {/* 1:1 Notes */}
          {(() => {
            const active = activePage === 'notes'
            return (
              <button onClick={() => setActivePage('notes')} title={sidebarCollapsed ? '1:1 Notes' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <span style={{ fontSize: 14 }}>📝</span>
                {!sidebarCollapsed && '1:1 Notes'}
              </button>
            )
          })()}

          {/* Check-ins */}
          {(() => {
            const active = activePage === 'checkins'
            return (
              <button onClick={() => setActivePage('checkins')} title={sidebarCollapsed ? 'Check-ins' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <span style={{ fontSize: 14 }}>📊</span>
                {!sidebarCollapsed && 'Check-ins'}
              </button>
            )
          })()}

          {/* Peer Reviews */}
          {(() => {
            const active = activePage === 'peer-feedback'
            return (
              <button onClick={() => setActivePage('peer-feedback')} title={sidebarCollapsed ? 'Peer Reviews' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <span style={{ fontSize: 14 }}>⭐</span>
                {!sidebarCollapsed && 'Peer Reviews'}
              </button>
            )
          })()}

          {/* PIPs */}
          {(() => {
            const active = activePage === 'pip'
            const activePips = pipPlans.filter(p => p.status === 'active').length
            return (
              <button onClick={() => { setActivePage('pip'); fetchPipPlans() }} title={sidebarCollapsed ? 'PIPs' : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: sidebarCollapsed ? '8px' : '8px 10px', borderRadius: 8, border: active ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent', background: active ? '#1e1f3a' : 'transparent', color: active ? '#e0e7ff' : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: 2 }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = active ? '#1e1f3a' : 'transparent' }}>
                <span style={{ fontSize: 14 }}>📈</span>
                {!sidebarCollapsed && 'PIPs'}
                {activePips > 0 && !sidebarCollapsed && <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#0d0f1a', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px' }}>{activePips}</span>}
              </button>
            )
          })()}
        </div>

        {/* Sidebar footer — profile + admin + sign out */}
        <div style={{ borderTop: '1px solid #1e2130', padding: '8px', flexShrink: 0 }}>
          {/* Settings */}
          <button onClick={() => setShowSettings(true)} title={sidebarCollapsed ? 'Settings' : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: settings.driveFolderUrl ? '#818cf8' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 500, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
            onMouseOver={e => { e.currentTarget.style.background = '#13151f' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
            <Settings size={15} />
            {!sidebarCollapsed && 'Settings'}
          </button>
          {/* Profile */}
          <button onClick={() => setShowProfile(true)} title={sidebarCollapsed ? (profileName || profileEmail || 'Profile') : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 500, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
            onMouseOver={e => { e.currentTarget.style.background = '#13151f' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {(profileName || profileEmail).charAt(0).toUpperCase() || '?'}
            </div>
            {!sidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileName || profileEmail || 'Profile'}</span>}
          </button>
          {/* Admin Portal */}
          {profileRole === 'admin' && (
            <a href="/admin" title={sidebarCollapsed ? 'Admin Portal' : undefined}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 500, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', textDecoration: 'none' }}
              onMouseOver={e => { e.currentTarget.style.background = '#13151f' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 14 }}>⚙️</span>
              {!sidebarCollapsed && 'Admin Portal'}
            </a>
          )}
          {/* Sign out */}
          <button
            onClick={async () => { const { createClient } = await import('@/lib/supabase/client'); await createClient().auth.signOut(); window.location.href = '/login' }}
            title={sidebarCollapsed ? 'Sign out' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px', borderRadius: 8, border: 'none', background: 'transparent',
              color: '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            }}
            onMouseOver={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = '#1a1010' }}
            onMouseOut={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={15} />
            {!sidebarCollapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0b0d14' }}>

        {/* ── History page ── */}
        {activePage === 'history' && (
          <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>History</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>All performance reviews you&apos;ve created, including completed and exported ones.</p>
            {saves.length === 0 ? (
              <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, color: '#9ca3af' }}>No reviews yet. Create your first one.</div>
              </div>
            ) : saves.map(save => {
              const pct = reviewPct(save)
              const isConfirming = confirmDeleteId === save.id
              return (
                <div key={save.id}
                  onClick={() => { if (!isConfirming) { handleLoad(save); setActivePage('reviews') } }}
                  style={{ background: '#13151f', border: `1px solid ${isConfirming ? '#5c2020' : '#1e2130'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color 0.15s, background 0.15s', cursor: isConfirming ? 'default' : 'pointer' }}
                  onMouseEnter={e => { if (!isConfirming) e.currentTarget.style.background = '#1a1c2e' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#13151f' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: pct === 100 ? '#0d1a13' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: pct === 100 ? '2px solid #34d399' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: pct === 100 ? '#34d399' : 'white', flexShrink: 0 }}>
                    {pct === 100 ? '✓' : save.employeeName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{save.employeeName || 'Untitled'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{save.employeePosition || 'No position'} · {pct}% complete · {save.savedAt ? new Date(save.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {isConfirming ? (
                      <>
                        <span style={{ fontSize: 12, color: '#f87171' }}>Delete this review?</span>
                        <button onClick={() => { handleDelete(save.id); if (save.id === currentReviewId) { setCurrentReviewId(''); setForm(defaultForm()) }; setConfirmDeleteId(null) }}
                          style={{ padding: '5px 12px', background: '#5c2020', color: '#f87171', border: '1px solid #7c2020', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Delete
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: '5px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {save.driveUrl && <a href={save.driveUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', background: '#0d1a13', color: '#34d399', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid #1a4a35' }}>Drive</a>}
                        <button onClick={() => setConfirmDeleteId(save.id)}
                          style={{ padding: '5px 8px', background: 'transparent', color: '#4b5563', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Delete review">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Team page ── */}
        {activePage === 'team' && (
          <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Team</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Your direct reports and their self-assessment status.</p>
            {dbTeam.length === 0 ? (
              <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 6 }}>No direct reports assigned yet.</div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Ask your admin to assign employees to your team in the admin portal.</div>
              </div>
            ) : dbTeam.map(r => {
              const sa = dbTeamSaMap[r.id]
              const displayName = r.name || r.email
              const existingReview = saves.find(s => s.employeeId === r.id) ?? saves.find(s => s.employeeName === displayName)
              const hasReview = !!existingReview
              return (
                <div key={r.id} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{displayName}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{r.email}</div>
                    </div>
                    {sa?.status === 'submitted' && (
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#1e1f3a', color: '#818cf8', border: '1px solid rgba(129,140,248,0.4)' }}>
                        ✓ Self-assessment submitted
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#0d1a13', color: '#34d399', border: '1px solid #1a4a35' }}>Active</span>
                    {sa ? (
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sa.status === 'submitted' ? '#1e1f3a' : '#1f1a0d', color: sa.status === 'submitted' ? '#818cf8' : '#f59e0b', border: `1px solid ${sa.status === 'submitted' ? 'rgba(129,140,248,0.4)' : '#92400e'}` }}>
                        Self-assessment: {sa.status}{sa.submitted_at ? ` · ${new Date(sa.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#13151f', color: '#4b5563', border: '1px solid #1e2130' }}>No self-assessment</span>
                    )}
                    {hasReview && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#0d0f1a', color: '#6b7280', border: '1px solid #1e2130' }}>Review started</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {sa?.status === 'submitted' && (
                      <button onClick={() => openSA(r.id, r.name || r.email, r.position || '')}
                        style={{ padding: '7px 14px', background: '#13151f', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        📋 View SA
                      </button>
                    )}
                    <button onClick={() => {
                      if (existingReview) {
                        handleLoad(existingReview)
                      } else {
                        handleNewReview()
                        update({ employeeName: r.name || r.email, employeePosition: r.position || '', employeeDivision: r.division || '', employeePronouns: r.pronouns || '', supervisorName: profileName || profileEmail || '', appraisalPeriod: r.start_date ? computeAppraisalPeriod(r.start_date) : '', reviewDate: r.start_date ? computeReviewDate(r.start_date) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })
                        setCurrentEmployeeId(r.id)
                      }
                      setActivePage('reviews')
                    }}
                      style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {existingReview ? '▶ Continue Review' : sa?.status === 'submitted' ? '✨ Start Review' : 'Start Review'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Manager Guide page ── */}
        {activePage === 'guide' && (
          <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Manager Guide</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Best practices and guidance for conducting performance reviews.</p>
            {[
              { title: 'Preparation', accent: '#818cf8', content: 'Before writing a review, gather concrete examples of the employee\'s work. Reference their job description, any prior reviews, and feedback you\'ve collected throughout the year. Avoid relying solely on recent events — look at the full review period.' },
              { title: 'Choosing Competencies', accent: '#818cf8', content: 'Select two positive competencies that genuinely reflect the employee\'s strengths — be specific and back them with examples. Choose two constructive competencies that represent real growth opportunities. The fifth competency is your choice and can be either.' },
              { title: 'Writing Strong Examples', accent: '#818cf8', content: 'Use the STAR method: Situation, Task, Action, Result. Describe specific behaviors and their impact on the team or business. Avoid vague praise like "great work" — specificity is what makes feedback credible and actionable. Use ✨ AI Draft to help expand your notes.' },
              { title: 'Goals & Objectives', accent: '#34d399', content: 'Review the employee\'s goals from the prior cycle. Mark each as successful, unsuccessful, or ongoing with a clear explanation. Unsuccessful goals should be treated as learning opportunities, not criticism. Use AI Draft Goals on the next-year step to generate SMART goals from the constructive competencies.' },
              { title: 'Rating Guidelines', accent: '#f59e0b', content: '5 - Outstanding: Consistently exceeds all expectations with significant impact.\n4 - Exceeds: Regularly goes beyond requirements.\n3 - Meets Expectations: Solid, reliable performance at the expected level.\n2 - Needs Improvement: Inconsistent; key areas require attention.\n1 - Unsatisfactory: Performance is below acceptable standards.' },
              { title: 'Having the Conversation', accent: '#f97316', content: 'Share the review with the employee before your meeting so they can read it. During the conversation, let them respond — the self-assessment comparison tool helps you see their perspective. Focus on development, not just evaluation. End with clear, agreed-upon goals for the next cycle.' },
              { title: 'Mistakes to Avoid', accent: '#f87171', content: '• Recency bias — don\'t let the last few weeks overshadow the full year.\n• Halo/horn effect — one strong or weak area shouldn\'t color your view of everything else.\n• Vague language — be specific about behaviors, not personality traits.\n• Skipping the self-assessment comparison — employee perspective matters.\n• Waiting until review time to give feedback — reviews should never be a surprise.' },
            ].map(s => (
              <div key={s.title} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '16px 20px', marginBottom: 10, borderLeft: `3px solid ${s.accent}` }}>
                <div style={{ fontWeight: 700, color: s.accent, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.content}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Competency Glossary page ── */}
        {activePage === 'glossary' && (
          <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Competency Glossary</h1>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Definitions for all 40 competency terms used in performance reviews.</p>
            <input value={managerGlossarySearch} onChange={e => setManagerGlossarySearch(e.target.value)} placeholder="Search by term or definition…" style={{ width: '100%', background: '#0d0f1a', border: '1px solid #2a2d3a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e5e7eb', boxSizing: 'border-box', outline: 'none', marginBottom: 16 }} />
            {COMPETENCIES.filter(c => c.name.toLowerCase().includes(managerGlossarySearch.toLowerCase()) || c.definition.toLowerCase().includes(managerGlossarySearch.toLowerCase())).map(c => (
              <div key={c.name} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '14px 18px', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: '#818cf8', fontSize: 14, marginBottom: 5 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>{c.definition}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Notifications page ── */}
        {activePage === 'notifications' && (
          <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Notifications</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Action items and activity across your team&apos;s review cycle.</p>
            {(() => {
              const items: { icon: string; color: string; label: string; detail: string; action?: () => void }[] = []
              // Submitted self-assessments waiting on a review
              dbTeam.forEach(r => {
                const sa = dbTeamSaMap[r.id]
                if (sa?.status === 'submitted') {
                  items.push({ icon: '📋', color: '#818cf8', label: `${r.name || r.email} submitted their self-assessment`, detail: `Submitted ${sa.submitted_at ? new Date(sa.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'recently'}. Start their review when ready.`, action: () => { setShowEmployeePicker(true); setActivePage('reviews') } })
                }
              })
              // In-progress reviews
              saves.filter(s => { const p = reviewPct(s); return p > 0 && p < 100 }).forEach(s => {
                const pct = reviewPct(s)
                items.push({ icon: '✏️', color: '#f59e0b', label: `${s.employeeName}'s review is ${pct}% complete`, detail: 'This review is in progress and hasn\'t been exported yet.', action: () => { handleLoad(s); setActivePage('reviews') } })
              })
              // Completed reviews not yet exported
              saves.filter(s => reviewPct(s) === 100 && !s.driveUrl).forEach(s => {
                items.push({ icon: '✅', color: '#34d399', label: `${s.employeeName}'s review is complete — not yet exported`, detail: 'All steps are done. Export to Google Drive to share with the employee.', action: () => { handleLoad(s); setActivePage('reviews') } })
              })
              if (items.length === 0) return (
                <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                  <div style={{ fontSize: 14, color: '#9ca3af' }}>All caught up! No pending action items.</div>
                </div>
              )
              return items.map((item, i) => (
                <div key={i} onClick={item.action} style={{ background: '#13151f', border: `1px solid #1e2130`, borderLeft: `3px solid ${item.color}`, borderRadius: 12, padding: '14px 20px', marginBottom: 10, cursor: item.action ? 'pointer' : 'default', display: 'flex', gap: 14, alignItems: 'flex-start' }}
                  onMouseOver={e => { if (item.action) e.currentTarget.style.background = '#1a1c2e' }}
                  onMouseOut={e => { e.currentTarget.style.background = '#13151f' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{item.detail}</div>
                    {item.action && <div style={{ fontSize: 11, color: item.color, marginTop: 5, fontWeight: 600 }}>View →</div>}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        {/* ── Review Cycles page ── */}
        {activePage === 'cycles' && (
          <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Review Cycles</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Track where each employee is in the review process.</p>
            {dbTeam.length === 0 ? (
              <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔄</div>
                <div style={{ fontSize: 14, color: '#9ca3af' }}>No team members found.</div>
              </div>
            ) : dbTeam.map(r => {
              const displayName = r.name || r.email
              const saStatus = dbTeamSaMap[r.id]
              const save = saves.find(s => s.employeeId === r.id) ?? saves.find(s => s.employeeName === displayName)
              const empSig = save ? reviewSignatures[save.id] : null

              // Derive stage
              let stage: string
              let stageColor: string
              let stageBg: string
              let stageBorder: string
              let actionLabel: string
              let actionFn: () => void

              if (save && save.managerSignedAt && empSig?.employee_signed_at) {
                stage = 'Both Signed'; stageColor = '#34d399'; stageBg = '#0d1a13'; stageBorder = '#1a4a35'
                actionLabel = 'Go to Meeting'; actionFn = () => { setMeetingDetailId(save.id); setActivePage('meeting') }
              } else if (save && save.managerSignedAt) {
                stage = 'Awaiting Employee Signature'; stageColor = '#f59e0b'; stageBg = '#1f1a0d'; stageBorder = '#92400e'
                actionLabel = 'Go to Meeting'; actionFn = () => { setMeetingDetailId(save.id); setActivePage('meeting') }
              } else if (save && reviewPct(save) === 100) {
                stage = 'Review Complete — Awaiting Sign-off'; stageColor = '#60a5fa'; stageBg = '#0d1523'; stageBorder = '#1e3a5f'
                actionLabel = 'View Review'; actionFn = () => { handleLoad(save); setActivePage('reviews') }
              } else if (save && reviewPct(save) > 0) {
                stage = 'Review In Progress'; stageColor = '#a78bfa'; stageBg = '#1a1430'; stageBorder = '#4c1d95'
                actionLabel = 'Continue Review'; actionFn = () => { handleLoad(save); setActivePage('reviews') }
              } else if (saStatus?.status === 'submitted') {
                stage = 'SA Submitted — Ready to Review'; stageColor = '#818cf8'; stageBg = '#1e1f3a'; stageBorder = 'rgba(129,140,248,0.4)'
                actionLabel = 'Start Review'; actionFn = () => { handleNewReview(); update({ employeeName: r.name || r.email, employeePosition: r.position || '', employeeDivision: r.division || '', employeePronouns: r.pronouns || '', supervisorName: profileName || profileEmail || '', appraisalPeriod: r.start_date ? computeAppraisalPeriod(r.start_date) : '', reviewDate: r.start_date ? computeReviewDate(r.start_date) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }); setCurrentEmployeeId(r.id); setActivePage('reviews') }
              } else {
                stage = 'Not Started'; stageColor = '#6b7280'; stageBg = '#13151f'; stageBorder = '#2a2d3a'
                actionLabel = 'Start Review'; actionFn = () => { handleNewReview(); update({ employeeName: r.name || r.email, employeePosition: r.position || '', employeeDivision: r.division || '', employeePronouns: r.pronouns || '', supervisorName: profileName || profileEmail || '', appraisalPeriod: r.start_date ? computeAppraisalPeriod(r.start_date) : '', reviewDate: r.start_date ? computeReviewDate(r.start_date) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }); setCurrentEmployeeId(r.id); setActivePage('reviews') }
              }

              // Pipeline dots: SA → Review → Complete → Signed → Done
              const stageIndex = stage === 'Not Started' ? 0
                : stage === 'SA Submitted — Ready to Review' ? 1
                : stage === 'Review In Progress' ? 2
                : stage === 'Review Complete — Awaiting Sign-off' ? 2
                : stage === 'Awaiting Employee Signature' ? 3
                : stage === 'Both Signed' ? 4
                : 0
              const pipelineStages = ['SA', 'Review', 'Complete', 'Signed', 'Done']
              const pipelineColors = ['#818cf8', '#a78bfa', '#60a5fa', '#f59e0b', '#34d399']

              return (
                <div key={r.id} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '18px 22px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{displayName}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{r.position || r.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: stageBg, color: stageColor, border: `1px solid ${stageBorder}`, whiteSpace: 'nowrap' }}>{stage}</span>
                      <button onClick={actionFn} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{actionLabel}</button>
                    </div>
                  </div>
                  {/* Pipeline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    {pipelineStages.map((ps, pi) => {
                      const isActive = pi === stageIndex
                      const isDone = pi < stageIndex
                      const color = isDone || isActive ? pipelineColors[pi] : '#2a2d3a'
                      return (
                        <div key={ps} style={{ display: 'flex', alignItems: 'center', flex: pi < pipelineStages.length - 1 ? 1 : 'none' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDone ? color : isActive ? color + '30' : '#13151f', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: isDone ? '#0d0f1a' : color, fontWeight: 700, flexShrink: 0 }}>
                              {isDone ? '✓' : pi + 1}
                            </div>
                            <span style={{ fontSize: 9, color: isActive ? color : isDone ? '#6b7280' : '#374151', fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap' }}>{ps}</span>
                          </div>
                          {pi < pipelineStages.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: isDone ? pipelineColors[pi] : '#1e2130', margin: '0 4px', marginBottom: 14, transition: 'background 0.3s' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Annual Reviews page ── */}
        {activePage === 'meeting' && (() => {
          // All saves that qualify as meeting records (manager has signed)
          const meetingSaves = saves.filter(s => s.managerSignedAt || s.driveUrl || s.maxStep >= 8)

          // ── LIST VIEW ──────────────────────────────────────────────────────────────
          if (!meetingDetailId) {
            return (
              <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
                <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Annual Reviews</h1>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>All current and past 1:1 review meetings.</p>

                {meetingSaves.length === 0 ? (
                  <div style={{ padding: '32px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                    No signed reviews ready for a 1:1 meeting yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {meetingSaves.map(s => {
                      const empSig = reviewSignatures[s.id]
                      const isCompleted = !!s.driveUrl
                      const bothSigned = !!(s.managerSignedAt && empSig?.employee_signed_at)
                      const status: string = isCompleted ? 'Completed' : bothSigned ? 'Ready to Submit' : 'Manager Signed'
                      const statusColor = isCompleted ? '#34d399' : bothSigned ? '#818cf8' : '#f59e0b'
                      const statusBg = isCompleted ? '#0d2b1f' : bothSigned ? '#1a1a3a' : '#2a1f00'
                      const statusBorder = isCompleted ? '#1a4a35' : bothSigned ? '#2e2e6a' : '#4a3300'
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f2fa' }}>{s.employeeName}</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>{s.employeePosition} · {s.managerSignedAt ? new Date(s.managerSignedAt).toLocaleDateString() : '—'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
                            <button
                              onClick={() => { setMeetingDetailId(s.id) }}
                              style={{ padding: '7px 16px', background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, color: '#c7d0f8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Open →
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // ── DETAIL VIEW ────────────────────────────────────────────────────────────
          const mSave = saves.find(s => s.id === meetingDetailId) ?? null
          if (!mSave) {
            return (
              <div style={{ padding: '28px 32px' }}>
                <button onClick={() => setMeetingDetailId(null)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>← Back to Meetings</button>
                <div style={{ color: '#6b7280' }}>Meeting not found.</div>
              </div>
            )
          }

          const mEmpSig = reviewSignatures[mSave.id]
          const isCompleted = !!mSave.driveUrl
          const mBothSigned = !!(mSave.managerSignedAt && mEmpSig?.employee_signed_at)
          const effectiveMeetingId = mSave.id

          async function handleMeetingMgrSign(result: SignatureResult) {
            setMeetingMgrSigLoading(true)
            setMeetingMgrSigError('')
            try {
              const res = await fetch('/api/reviews/manager-sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId: effectiveMeetingId, managerSignature: encodeSignature(result) }),
              })
              const data = await res.json() as { ok?: boolean; signedAt?: string; error?: string }
              if (!res.ok) throw new Error(data.error ?? 'Failed')
              const signedAt = data.signedAt ?? new Date().toISOString()
              setSaves(prev => prev.map(s => s.id === effectiveMeetingId
                ? { ...s, managerSignedAt: signedAt, managerSignature: encodeSignature(result) }
                : s))
            } catch (e) {
              setMeetingMgrSigError(String(e))
            } finally {
              setMeetingMgrSigLoading(false)
            }
          }

          async function handleMeetingEmpSign(result: SignatureResult) {
            setMeetingEmpSigLoading(true)
            setMeetingEmpSigError('')
            try {
              const res = await fetch('/api/reviews/meeting-sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId: effectiveMeetingId, employeeSignature: encodeSignature(result) }),
              })
              const data = await res.json() as { ok?: boolean; signedAt?: string; error?: string }
              if (!res.ok) throw new Error(data.error ?? 'Failed')
              setReviewSignatures(prev => ({ ...prev, [effectiveMeetingId]: { employee_signed_at: data.signedAt ?? new Date().toISOString(), employee_signature: encodeSignature(result) } }))
              setMeetingEmpSigSuccess(true)
            } catch (e) {
              setMeetingEmpSigError(String(e))
            } finally {
              setMeetingEmpSigLoading(false)
            }
          }

          return (
            <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
              {/* Back nav */}
              <button
                onClick={() => setMeetingDetailId(null)}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}
              >
                ← Back to Meetings
              </button>

              <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>
                Annual Review — {mSave.employeeName}
              </h1>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
                {isCompleted ? 'Completed · Read-only' : 'Side-by-side view for your meeting with the employee.'}
              </p>

              {/* Self-Assessment panel */}
              {(() => {
                const mForm = mSave.form
                return mForm ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                      {/* Left: Self-Assessment */}
                      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 640, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#1a1430', border: '1px solid #4c1d95', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self-Assessment</div>
                          {meetingSAData?.submitted_at && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Submitted {new Date(meetingSAData.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#0d0f1a', border: '1px solid #4c1d95', borderRadius: '0 0 10px 10px' }}>
                          {meetingSALoading ? (
                            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading…</div>
                          ) : !meetingSAData ? (
                            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280', fontSize: 13 }}>No self-assessment found for this employee.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {meetingSAData.competencies?.filter(c => c.term).length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Competencies</div>
                                  {meetingSAData.competencies.filter(c => c.term).map((c, i) => {
                                    const col = c.type === 'positive' ? '#10b981' : c.type === 'constructive' ? '#f97316' : '#818cf8'
                                    return (
                                      <div key={i} style={{ background: '#13151f', border: `1px solid ${col}30`, borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>{c.term}</div>
                                        {c.examples.filter(e => e.trim()).map((ex, ei) => (
                                          <div key={ei} style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 2 }}>{ex}</div>
                                        ))}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {meetingSAData.goals_objectives?.filter(g => g.description?.trim()).length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Goals & Objectives</div>
                                  {meetingSAData.goals_objectives.filter(g => g.description?.trim()).map((g, i) => (
                                    <div key={i} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                      <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 4 }}>{g.description}</div>
                                      {g.outcome && <span style={{ fontSize: 11, fontWeight: 600, color: g.outcome === 'successful' ? '#34d399' : g.outcome === 'ongoing' ? '#f59e0b' : '#f87171' }}>{g.outcome}</span>}
                                      {g.reasoning && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{g.reasoning}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {meetingSAData.overall_rating !== null && meetingSAData.overall_rating !== undefined && (
                                <div style={{ padding: '10px 14px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Self Rating</span>
                                  <span style={{ fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>{'★'.repeat(meetingSAData.overall_rating || 0)}{'☆'.repeat(5 - (meetingSAData.overall_rating || 0))}</span>
                                </div>
                              )}
                              {meetingSAData.next_year_goals?.filter(g => g.goal?.trim()).length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Next Year&apos;s Goals</div>
                                  {meetingSAData.next_year_goals.filter(g => g.goal?.trim()).map((g, i) => (
                                    <div key={i} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>{g.goal}</div>
                                      {g.objective && <div style={{ fontSize: 11, color: '#9ca3af' }}>{g.objective}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Performance Review */}
                      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 640, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#0d1523', border: '1px solid #1e3a5f', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance Review</div>
                          {mForm.reviewDate && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Review Date: {mForm.reviewDate}</div>}
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#0d0f1a', border: '1px solid #1e3a5f', borderRadius: '0 0 10px 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: '10px 14px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>{mForm.employeeName}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{mForm.employeePosition}{mForm.appraisalPeriod ? ` · ${mForm.appraisalPeriod}` : ''}</div>
                              {mForm.supervisorName && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>Supervisor: {mForm.supervisorName}</div>}
                            </div>
                            {[
                              { entry: mForm.competencyOne, type: 'positive' },
                              { entry: mForm.competencyTwo, type: 'positive' },
                              { entry: mForm.competencyThree, type: 'constructive' },
                              { entry: mForm.competencyFour, type: 'constructive' },
                              { entry: mForm.competencyFive, type: mForm.competencyFiveType },
                            ].filter(c => c.entry.competency).length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Competencies</div>
                                {[
                                  { entry: mForm.competencyOne, type: 'positive' },
                                  { entry: mForm.competencyTwo, type: 'positive' },
                                  { entry: mForm.competencyThree, type: 'constructive' },
                                  { entry: mForm.competencyFour, type: 'constructive' },
                                  { entry: mForm.competencyFive, type: mForm.competencyFiveType },
                                ].filter(c => c.entry.competency).map((c, i) => {
                                  const col = c.type === 'positive' ? '#10b981' : '#f97316'
                                  return (
                                    <div key={i} style={{ background: '#13151f', border: `1px solid ${col}30`, borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>{c.entry.competency}</div>
                                      {c.entry.examples.filter(e => e.trim()).map((ex, ei) => (
                                        <div key={ei} style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 2 }}>{ei + 1}. {ex}</div>
                                      ))}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {mForm.goals?.filter(g => g.text.trim()).length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Goals &amp; Objectives</div>
                                {mForm.goals.filter(g => g.text.trim()).map((g, i) => (
                                  <div key={i} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                    <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 2 }}>{g.text}</div>
                                    {g.status && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: g.status === 'successful' ? '#0d2b1f' : g.status === 'unsuccessful' ? '#1f0d0d' : '#1f1a0d', color: g.status === 'successful' ? '#34d399' : g.status === 'unsuccessful' ? '#f87171' : '#f59e0b' }}>{g.status}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {mForm.overallScore > 0 && (
                              <div style={{ padding: '10px 14px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Overall Score</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{'★'.repeat(mForm.overallScore)}{'☆'.repeat(5 - mForm.overallScore)}</span>
                                <span style={{ fontSize: 12, color: '#9ca3af' }}>{SCORE_LABELS[mForm.overallScore]?.label}</span>
                              </div>
                            )}
                            {mForm.nextGoals?.filter(g => g.text.trim()).length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Next Year&apos;s Goals</div>
                                {mForm.nextGoals.filter(g => g.text.trim()).map((g, i) => (
                                  <div key={i} style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>{g.text}</div>
                                    {g.targetDate && <div style={{ fontSize: 11, color: '#6b7280' }}>Target: {g.targetDate}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comparison Section */}
                    <div style={{ marginBottom: 20 }}>
                      <ComparisonSection
                        form={mSave.form ?? { ...defaultForm(), employeeName: mSave.employeeName, employeePosition: mSave.employeePosition }}
                        savedComparisonReport={mSave.comparisonReport}
                        saData={meetingSAData}
                        onReportSaved={report => {
                          apiPatchReview(effectiveMeetingId, { comparison_report: report || null })
                          setSaves(prev => prev.map(s => s.id === effectiveMeetingId ? { ...s, comparisonReport: report || undefined } : s))
                        }}
                      />
                    </div>
                  </>
                ) : null
              })()}

              {/* Signatures section */}
              <div style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2fa', marginBottom: 16 }}>Meeting Confirmation &amp; Signatures</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Manager signature */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manager</div>
                    {mSave.managerSignedAt ? (
                      <div style={{ padding: '12px 14px', background: '#0d2b1f', border: '1px solid #1a4a35', borderRadius: 8 }}>
                        <SignatureDisplay stored={mSave.managerSignature ?? ''} date={mSave.managerSignedAt} />
                      </div>
                    ) : isCompleted ? (
                      <div style={{ padding: '12px 14px', color: '#6b7280', fontSize: 13 }}>No manager signature recorded.</div>
                    ) : (
                      <SignaturePad
                        onSign={handleMeetingMgrSign}
                        loading={meetingMgrSigLoading}
                        error={meetingMgrSigError}
                        buttonLabel="✍️ Manager Sign"
                      />
                    )}
                  </div>
                  {/* Employee signature */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Employee</div>
                    {mEmpSig?.employee_signed_at ? (
                      <div style={{ padding: '12px 14px', background: '#0d2b1f', border: '1px solid #1a4a35', borderRadius: 8 }}>
                        <SignatureDisplay stored={mEmpSig.employee_signature ?? ''} date={mEmpSig.employee_signed_at} />
                      </div>
                    ) : isCompleted ? (
                      <div style={{ padding: '12px 14px', color: '#6b7280', fontSize: 13 }}>No employee signature recorded.</div>
                    ) : (
                      <SignaturePad
                        onSign={handleMeetingEmpSign}
                        loading={meetingEmpSigLoading}
                        error={meetingEmpSigError}
                        buttonLabel="✍️ Employee Sign"
                      />
                    )}
                  </div>
                </div>
                {(mBothSigned || meetingEmpSigSuccess) && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: '#0d2b1f', border: '1px solid #1a4a35', borderRadius: 8, fontSize: 13, color: '#34d399', fontWeight: 600 }}>
                    ✓ Both parties have signed. Admin has been notified.
                  </div>
                )}
              </div>

              {/* Final Submit — hidden for completed/past meetings */}
              {(mSave.driveUrl || meetingDriveStatus === 'done') && (
                <div style={{ marginTop: 24, padding: '16px 20px', background: '#0d2b1f', border: '1px solid #1a4a35', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 12 }}>✓ Review Complete — Google Drive Documents</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mSave.driveUrl && (
                      <a href={mSave.driveUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#0a1a10', border: '1px solid #1a4a35', borderRadius: 8, textDecoration: 'none', color: '#6ee7b7', fontSize: 12, fontWeight: 500 }}>
                        <span>📄</span>
                        <span>Performance Review — {mSave.employeeName}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4b5563' }}>Open in Drive ↗</span>
                      </a>
                    )}
                    {meetingSAData?.drive_url && (
                      <a href={meetingSAData.drive_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#0a1a10', border: '1px solid #1a4a35', borderRadius: 8, textDecoration: 'none', color: '#6ee7b7', fontSize: 12, fontWeight: 500 }}>
                        <span>📝</span>
                        <span>Self-Assessment — {mSave.employeeName}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4b5563' }}>Open in Drive ↗</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {!isCompleted && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #1e2130' }}>
                  {meetingDriveError && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', background: '#1a0d0d', border: '1px solid #7f1d1d', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
                      Drive export failed: {meetingDriveError} — <button onClick={() => setMeetingDriveError('')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Retry</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ fontSize: 12, color: mBothSigned || meetingEmpSigSuccess ? '#34d399' : '#4b5563' }}>
                      {meetingDriveStatus === 'done'
                        ? '✓ Documents saved to Google Drive. Review cycle complete.'
                        : meetingDriveStatus === 'uploading'
                          ? '⏳ Saving documents to Google Drive…'
                          : mBothSigned || meetingEmpSigSuccess
                            ? '✓ Both signatures collected. Ready to submit.'
                            : 'Both manager and employee must sign before submitting.'}
                    </div>
                    <button
                      type="button"
                      disabled={!(mBothSigned || meetingEmpSigSuccess) || meetingDriveStatus === 'uploading' || meetingDriveStatus === 'done'}
                      onClick={async () => {
                        const reviewForm = mSave.form ?? { ...defaultForm(), employeeName: mSave.employeeName, employeePosition: mSave.employeePosition }
                        if (!reviewForm || !effectiveMeetingId) return
                        setMeetingDriveStatus('uploading')
                        setMeetingDriveError('')
                        try {
                          const folderId = parseFolderId(settings.driveFolderUrl)
                          const res = await fetch('/api/performance-review/send-to-drive', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              ...reviewForm,
                              ...(folderId ? { driveFolderId: folderId } : {}),
                              employeeId: mSave.employeeId,
                              managerEmail: profileEmail,
                            }),
                          })
                          const ct = res.headers.get('content-type') ?? ''
                          if (!ct.includes('application/json')) throw new Error(`Server returned non-JSON response (status ${res.status}). Check server logs.`)
                          const data = await res.json() as { docUrl?: string; docId?: string; error?: string }
                          if (!res.ok || data.error) throw new Error(data.error ?? 'Drive export failed')
                          const url = data.docUrl ?? ''
                          const docId = data.docId ?? ''
                          apiPatchReview(effectiveMeetingId, { drive_url: url || null, drive_doc_id: docId || null })
                          setSaves(prev => prev.map(s => s.id === effectiveMeetingId ? { ...s, driveUrl: url || undefined, driveDocId: docId || undefined } : s))
                          setMeetingDriveStatus('done')
                        } catch (e) {
                          setMeetingDriveStatus('error')
                          setMeetingDriveError(String(e))
                        }
                      }}
                      style={{
                        padding: '10px 22px',
                        background: mBothSigned || meetingEmpSigSuccess ? '#4f46e5' : '#1e2130',
                        border: 'none',
                        borderRadius: 8,
                        color: mBothSigned || meetingEmpSigSuccess ? '#fff' : '#4b5563',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: mBothSigned || meetingEmpSigSuccess ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Submit to Google Drive
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── 1:1 Notes page ── */}
        {activePage === 'notes' && renderNotes()}

        {/* ── Check-ins page ── */}
        {activePage === 'checkins' && renderCheckins()}

        {/* ── Peer Reviews (360°) page ── */}
        {activePage === 'peer-feedback' && renderPeerFeedback()}

        {/* ── PIP / Coaching Plans page ── */}
        {activePage === 'pip' && renderPip()}

        {/* ── Performance Reviews (form) ── */}
        {activePage === 'reviews' && (!currentReviewId ? (
          /* Empty state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 32 }}>
            <div style={{ fontSize: 48 }}>📋</div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>No review open</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Select a review from the sidebar or create a new one.</p>
              <button onClick={() => setShowEmployeePicker(true)} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + New Review
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Sticky employee info bar */}
            {form.employeeName.trim() && (
              <div className="mb-5 px-4 py-3 bg-[#13151f] border border-[#1e2130] rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {form.employeeName.trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-100 truncate">{form.employeeName}</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {[form.employeePosition, form.employeeDivision].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {saveStatus === 'saving' && <span className="text-[10px] text-gray-600 flex items-center gap-1 flex-shrink-0"><Loader2 size={10} className="animate-spin" /> Saving…</span>}
                {saveStatus === 'saved' && <span className="text-[10px] text-emerald-600 flex items-center gap-1 flex-shrink-0"><CheckCircle2 size={10} /> Saved</span>}
              </div>
            )}

            {/* Header — simplified */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h1 className="text-xl font-bold text-gray-100">Manager Performance Review</h1>
                  <p className="text-[12px] text-gray-500 mt-0.5">Fill out each section — copy individual parts or the full review at the end.</p>
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
          {step === 0 && <StepInfo form={form} update={update} directReports={directReports} dbTeam={dbTeam} managerName={profileName || undefined} />}
          {step === 1 && <StepCompetency form={form} update={update} index={1} type="positive" />}
          {step === 2 && <StepCompetency form={form} update={update} index={2} type="positive" />}
          {step === 3 && <StepCompetency form={form} update={update} index={3} type="constructive" />}
          {step === 4 && <StepCompetency form={form} update={update} index={4} type="constructive" />}
          {step === 5 && <StepCompetency form={form} update={update} index={5} type="either" canToggleType />}
          {step === 6 && <StepGoals form={form} update={update} saves={saves} currentReviewId={reviewIdRef.current} />}
          {step === 7 && <StepNextGoals form={form} update={update} />}
          {step === 8 && (
            <StepOutput
              key={currentReviewId}
              form={form}
              onSubmit={() => { setMeetingDetailId(null); setActivePage('meeting') }}
            />
          )}
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
              onClick={() => setShowEmployeePicker(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2030] text-sm text-gray-400 hover:text-red-400 hover:border-red-800/50 transition-all"
            >
              Start New Review
            </button>
          </div>
        )}
        </div>
        ))}
      </main>

      {/* ── SA Viewer Modal ── */}
      {viewingSA && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setViewingSA(null) }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1e2130', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f2fa' }}>{viewingSA.employeeName}</span>
                  {viewingSA.position && <span style={{ fontSize: 12, color: '#6b7280' }}>· {viewingSA.position}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Self-Assessment
                  {saData?.submitted_at && <> · Submitted {new Date(saData.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>}
                  {saData?.overall_rating && <> · {'★'.repeat(saData.overall_rating)} {['','Needs Improvement','Below Expectations','Meets Expectations','Exceeds Expectations','Outstanding'][saData.overall_rating]}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saData?.drive_url && <a href={saData.drive_url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: '#0d1a13', color: '#34d399', border: '1px solid #1a4a35', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Drive ↗</a>}
                <button onClick={() => setViewingSA(null)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e2130', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>
            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
              {saLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
              ) : !saData ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No submitted self-assessment found.</div>
              ) : (
                <>
                  {/* Competencies */}
                  {saData.competencies?.filter(c => c.term).length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Competencies</div>
                      {saData.competencies.filter(c => c.term).map((c, i) => {
                        const color = c.type === 'positive' ? '#10b981' : c.type === 'constructive' ? '#f97316' : '#818cf8'
                        return (
                          <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2130', borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: color + '20', color, border: `1px solid ${color}40` }}>{c.type === 'positive' ? 'Positive' : c.type === 'constructive' ? 'Constructive' : 'Choice'}</span>
                              <span style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb' }}>{c.term}</span>
                            </div>
                            {c.examples.filter(e => e.trim()).map((ex, ei) => (
                              <div key={ei} style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #1e2130' }}>{ex}</div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* Goals */}
                  {saData.goals_objectives?.filter(g => g.description.trim()).length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Goals & Objectives</div>
                      {saData.goals_objectives.filter(g => g.description.trim()).map((g, i) => (
                        <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, color: '#e5e7eb', marginBottom: 6 }}>{g.description}</div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {g.outcome && <span style={{ fontSize: 11, color: g.outcome === 'successful' ? '#34d399' : g.outcome === 'ongoing' ? '#f59e0b' : '#f87171', fontWeight: 600 }}>{g.outcome === 'successful' ? '✓ Successful' : g.outcome === 'ongoing' ? '↻ Ongoing' : '✗ Unsuccessful'}</span>}
                            {g.reasoning && <span style={{ fontSize: 11, color: '#6b7280' }}>{g.reasoning}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Next Year Goals */}
                  {saData.next_year_goals?.filter(g => g.goal.trim()).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Next Year&apos;s Goals</div>
                      {saData.next_year_goals.filter(g => g.goal.trim()).map((g, i) => (
                        <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>{g.goal}</div>
                          {g.objective && <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{g.objective}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Picker Modal ── */}
      {showEmployeePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowEmployeePicker(false)}>
          <div style={{ background: '#0d1117', border: '1px solid #1e2130', borderRadius: 16, padding: '24px', width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0f2fa' }}>Select Employee</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Choose who this review is for.</p>
              </div>
              <button onClick={() => setShowEmployeePicker(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dbTeam.filter(r => r.is_active).length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No active team members found.</p>
              ) : dbTeam.filter(r => r.is_active).map(r => (
                <button key={r.id} onClick={() => {
                  const existing = saves.find(s => s.employeeId === r.id) ?? saves.find(s => s.employeeName === (r.name || r.email))
                  if (existing) {
                    handleLoad(existing)
                  } else {
                    handleNewReview()
                    update({
                      employeeName: r.name || r.email,
                      employeePosition: r.position || '',
                      employeeDivision: r.division || '',
                      employeePronouns: r.pronouns || '',
                      supervisorName: profileName || profileEmail || '',
                      appraisalPeriod: r.start_date ? computeAppraisalPeriod(r.start_date) : '',
                      reviewDate: r.start_date ? computeReviewDate(r.start_date) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    })
                    setCurrentEmployeeId(r.id)
                  }
                  setActivePage('reviews')
                  setShowEmployeePicker(false)
                }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#13151f', border: '1px solid #1e2130', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(79,70,229,0.5)'; (e.currentTarget as HTMLButtonElement).style.background = '#1e1f3a' }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2130'; (e.currentTarget as HTMLButtonElement).style.background = '#13151f' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {(r.name || r.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{r.name || r.email}</div>
                    {r.position && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.position}{r.division ? ` · ${r.division}` : ''}</div>}
                  </div>
                  {saves.find(s => s.employeeId === r.id || s.employeeName === (r.name || r.email))
                    ? <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, padding: '2px 7px' }}>In Progress</span>
                    : dbTeamSaMap[r.id]?.status === 'submitted'
                      ? <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#818cf8', background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 6, padding: '2px 7px' }}>SA Ready</span>
                      : null
                  }
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
