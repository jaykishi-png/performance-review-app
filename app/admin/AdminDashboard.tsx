'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, RefreshCw, BarChart2,
  ClipboardList, Settings, ChevronLeft, ChevronRight,
  Plus, LogOut, ExternalLink, Bell,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRecord = {
  id: string; name: string | null; email: string; role: string
  is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string; position: string | null
}
type InviteRecord = {
  id: string; email: string; role: string; created_at: string; expires_at: string; accepted_at: string | null
}
type SelfAssessmentStatus = { employee_id: string; status: string; submitted_at: string | null }
type ReviewRecord = {
  id: string; user_id: string; employee_name: string; employee_position: string
  step: number; max_step: number; drive_url: string | null; drive_doc_id: string | null
  comparison_report: string | null; saved_at: string; updated_at: string;
  manager_signed_at: string | null; employee_signed_at: string | null;
  manager_signature: string | null; employee_signature: string | null;
}

type Props = {
  currentUser: { id: string; email: string; role: 'admin' | 'dev_admin' }
  users: UserRecord[]
  invites: InviteRecord[]
  selfAssessments: SelfAssessmentStatus[]
  reviews: ReviewRecord[]
}

type Page = 'dashboard' | 'users' | 'reviews' | 'cycles' | 'analytics' | 'audit' | 'settings'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: '#818cf8', dev_admin: '#f472b6', manager: '#34d399', employee: '#60a5fa', pending: '#f59e0b',
}
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', dev_admin: 'Dev Admin', manager: 'Manager', employee: 'Employee', pending: 'Pending',
}

const NAV: { id: Page; label: string; icon: React.FC<{ size: number; color?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'users',     label: 'Users',          icon: Users           },
  { id: 'reviews',   label: 'Reviews',        icon: FileText        },
  { id: 'cycles',    label: 'Review Cycles',  icon: RefreshCw       },
  { id: 'analytics', label: 'Analytics',      icon: BarChart2       },
  { id: 'audit',     label: 'Audit Log',      icon: ClipboardList   },
  { id: 'settings',  label: 'Settings',       icon: Settings        },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(startDate: string): number {
  const start = new Date(startDate)
  const today = new Date()
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
function annivDate(startDate: string): string {
  const start = new Date(startDate)
  const today = new Date()
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function yearsOfService(startDate: string): number {
  return new Date().getFullYear() - new Date(startDate).getFullYear()
}

// ── Component ─────────────────────────────────────────────────────────────────

// 8 content steps (0–7), step 8 = output. Complete when max_step >= 8.
const TOTAL_CONTENT_STEPS = 8

function reviewProgress(r: ReviewRecord): number {
  return Math.min(100, Math.round((r.max_step / TOTAL_CONTENT_STEPS) * 100))
}

function reviewStatus(r: ReviewRecord): 'exported' | 'complete' | 'in_progress' | 'not_started' {
  if (r.drive_url) return 'exported'
  if (r.max_step >= TOTAL_CONTENT_STEPS) return 'complete'
  if (r.max_step > 0) return 'in_progress'
  return 'not_started'
}

const STATUS_META = {
  exported:    { label: 'Exported',    color: '#34d399', bg: '#0d1a13', border: '#1a4a35' },
  complete:    { label: 'Complete',    color: '#818cf8', bg: '#13151f', border: 'rgba(129,140,248,0.3)' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#1f1a0d', border: '#92400e' },
  not_started: { label: 'Not Started', color: '#6b7280', bg: '#13151f', border: '#2a2d3a' },
}

export default function AdminDashboard({ currentUser, users, invites, selfAssessments, reviews }: Props) {
  const router = useRouter()
  const isDevAdmin = currentUser.role === 'dev_admin'

  const [page, setPage] = useState<Page>('dashboard')
  const [collapsed, setCollapsed] = useState(false)

  // Users state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'employee'>('employee')
  const [inviteManagerId, setInviteManagerId] = useState('')
  const [invitePosition, setInvitePosition] = useState('')
  const [inviteStartDate, setInviteStartDate] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteEmailSent, setInviteEmailSent] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editingManager, setEditingManager] = useState<string | null>(null)
  const [editingStartDate, setEditingStartDate] = useState<string | null>(null)
  const [editingPosition, setEditingPosition] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [reminderCopied, setReminderCopied] = useState<string | null>(null)

  // SA viewer
  type SAData = { competencies: {type:string;term:string;examples:string[]}[]; goals_objectives: {description:string;outcome:string;reasoning:string}[]; next_year_goals: {goal:string;objective:string}[]; overall_rating: number|null; submitted_at: string|null; drive_url: string|null }
  const [viewingSA, setViewingSA] = useState<{employeeId:string;employeeName:string;position:string|null}|null>(null)
  const [saData, setSAData] = useState<SAData|null>(null)
  const [saLoading, setSALoading] = useState(false)

  async function openSA(employeeId: string, employeeName: string, position: string|null) {
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

  // Reviews page state
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'exported' | 'complete' | 'in_progress' | 'not_started'>('all')
  const [reviewManagerFilter, setReviewManagerFilter] = useState<string>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin')
  const saMap = Object.fromEntries(selfAssessments.map(s => [s.employee_id, s]))
  const activeUsers = users.filter(u => u.is_active)

  const inviteRoleOptions = isDevAdmin
    ? (['employee', 'manager'] as const)
    : (['employee', 'manager', 'admin'] as const)
  const editRoleOptions = isDevAdmin
    ? ['manager', 'employee', 'pending']
    : ['admin', 'dev_admin', 'manager', 'employee', 'pending']

  const upcomingReviews = useMemo(() =>
    users
      .filter(u => u.start_date && u.is_active && u.role !== 'pending')
      .map(u => ({ ...u, daysUntil: daysUntil(u.start_date!), annDate: annivDate(u.start_date!), years: yearsOfService(u.start_date!) + 1 }))
      .filter(u => u.daysUntil <= 90)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  , [users])

  const urgentCount = upcomingReviews.filter(u => u.daysUntil <= 30).length

  const filteredUsers = useMemo(() => {
    let result = users
    if (userSearch) result = result.filter(u => (u.name || u.email).toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
    if (userRoleFilter !== 'all') result = result.filter(u => u.role === userRoleFilter)
    return result
  }, [users, userSearch, userRoleFilter])

  const filteredReviews = useMemo(() => {
    let result = reviews
    if (reviewSearch) result = result.filter(r => r.employee_name.toLowerCase().includes(reviewSearch.toLowerCase()) || r.employee_position.toLowerCase().includes(reviewSearch.toLowerCase()))
    if (reviewStatusFilter !== 'all') result = result.filter(r => reviewStatus(r) === reviewStatusFilter)
    if (reviewManagerFilter !== 'all') result = result.filter(r => r.user_id === reviewManagerFilter)
    return result
  }, [reviews, reviewSearch, reviewStatusFilter, reviewManagerFilter])

  async function deleteReview(id: string) {
    setDeleting(true)
    try {
      await fetch('/api/reviews', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setDeleteConfirm(null)
      router.refresh()
    } finally { setDeleting(false) }
  }

  // Notifications count for bell
  const notifCount = urgentCount + invites.length

  // ── Styles ────────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = { width: '100%', background: '#0d0f1a', border: '1px solid #2a2d3a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e5e7eb', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }
  const card: React.CSSProperties = { background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '18px 20px', marginBottom: 12 }
  const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1e2130' }
  const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #0d0f1a' }

  const navBtn = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: collapsed ? '8px' : '7px 10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: 8, border: active ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent',
    background: active ? '#1e1f3a' : 'transparent',
    cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s',
    fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#e0e7ff' : '#9ca3af',
  })

  // ── API helpers ───────────────────────────────────────────────────────────

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  async function sendInvite() {
    if (!inviteEmail) return
    if (isDevAdmin && inviteRole === 'admin') return
    setInviteLoading(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, managerId: inviteRole === 'employee' ? inviteManagerId || null : null, position: invitePosition || null, startDate: inviteStartDate || null }),
      })
      const data = await res.json()
      if (data.inviteLink) { setInviteLink(data.inviteLink); setInviteEmailSent(!!data.emailSent) }
      router.refresh()
    } finally { setInviteLoading(false) }
  }

  async function updateField(userId: string, fields: Record<string, unknown>) {
    if (isDevAdmin && fields.role && ['admin', 'dev_admin'].includes(fields.role as string)) return
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, ...fields }) })
    setEditingUser(null); setEditingManager(null); setEditingStartDate(null)
    router.refresh()
  }

  async function toggleActive(userId: string, isActive: boolean) {
    await updateField(userId, { is_active: !isActive })
  }

  function copyReminder(u: UserRecord & { daysUntil: number; annDate: string; years: number }) {
    const managerName = u.manager_id ? (users.find(m => m.id === u.manager_id)?.name || users.find(m => m.id === u.manager_id)?.email || 'their manager') : 'their manager'
    const text = `Hi ${managerName},\n\nThis is a reminder that ${u.name || u.email}'s annual performance review is coming up on ${u.annDate} (${u.daysUntil} days away) — marking their ${u.years}-year anniversary.\n\nPlease ensure their review is completed in advance of this date.\n\nThank you!`
    navigator.clipboard.writeText(text)
    setReminderCopied(u.id)
    setTimeout(() => setReminderCopied(null), 2000)
  }

  // ── Page renderers ────────────────────────────────────────────────────────

  function renderDashboard() {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Dashboard</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>Organization overview and upcoming review activity.</p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Users',       value: activeUsers.length,                                    color: '#f0f2fa', border: '#1e2130' },
            { label: 'Managers',          value: activeUsers.filter(u => u.role === 'manager').length,  color: '#34d399', border: '#1a4a35' },
            { label: 'Employees',         value: activeUsers.filter(u => u.role === 'employee').length, color: '#60a5fa', border: '#1e3a5f' },
            { label: 'Reviews Due (90d)', value: upcomingReviews.length, color: urgentCount > 0 ? '#f59e0b' : '#f0f2fa', border: urgentCount > 0 ? '#92400e' : '#1e2130' },
            { label: 'Pending Access',    value: users.filter(u => u.role === 'pending').length + invites.length, color: '#f0f2fa', border: '#1e2130' },
          ].map(s => (
            <div key={s.label} style={{ background: '#13151f', border: `1px solid ${s.border}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* SA status strip */}
        <div style={{ ...card, display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Self-Assessment Status</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Submitted',   value: selfAssessments.filter(s => s.status === 'submitted').length, color: '#34d399', bg: '#0d1a13', border: '#1a4a35' },
                { label: 'In Draft',    value: selfAssessments.filter(s => s.status === 'draft').length,     color: '#818cf8', bg: '#13151f', border: 'rgba(129,140,248,0.3)' },
                { label: 'Not Started', value: activeUsers.filter(u => u.role === 'employee' && !saMap[u.id]).length, color: '#6b7280', bg: '#13151f', border: '#2a2d3a' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 16px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: 1, background: '#1e2130', alignSelf: 'stretch' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Pending Invites</div>
            {invites.length === 0 ? (
              <div style={{ fontSize: 13, color: '#374151' }}>No pending invites</div>
            ) : invites.slice(0, 3).map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: `${ROLE_COLORS[inv.role] ?? '#64748b'}20`, color: ROLE_COLORS[inv.role] ?? '#64748b' }}>{ROLE_LABELS[inv.role] ?? inv.role}</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{inv.email}</span>
                <span style={{ fontSize: 11, color: '#374151', marginLeft: 'auto' }}>Expires {new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
            {invites.length > 3 && <div style={{ fontSize: 11, color: '#4b5563', cursor: 'pointer', marginTop: 4 }} onClick={() => setPage('users')}>+{invites.length - 3} more → view all</div>}
          </div>
        </div>

        {/* Upcoming reviews */}
        <div style={{ fontWeight: 600, fontSize: 13, color: '#f0f2fa', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          Upcoming Reviews
          {urgentCount > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: '#92400e30', color: '#f59e0b', fontWeight: 700 }}>{urgentCount} urgent</span>}
        </div>
        <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
          {upcomingReviews.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
              <div style={{ fontWeight: 500, color: '#9ca3af', marginBottom: 4 }}>No upcoming reviews in the next 90 days</div>
              <div style={{ fontSize: 12 }}>Add start dates to users in the Users page to track anniversaries.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Employee', 'Role', 'Manager', 'Review Date', 'Year', 'Days Away', 'Reminder'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {upcomingReviews.map(u => {
                  const isUrgent = u.daysUntil <= 30
                  const mgr = u.manager_id ? users.find(m => m.id === u.manager_id) : null
                  return (
                    <tr key={u.id} style={{ background: isUrgent ? '#1a110a' : 'transparent' }}>
                      <td style={td}><div style={{ fontWeight: 500, color: '#e5e7eb' }}>{u.name || '—'}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{u.email}</div></td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role] }}>{ROLE_LABELS[u.role]}</span></td>
                      <td style={{ ...td, color: '#9ca3af' }}>{mgr ? (mgr.name || mgr.email) : <span style={{ color: '#374151' }}>Unassigned</span>}</td>
                      <td style={{ ...td, color: '#c4c9d4', fontWeight: 500 }}>{u.annDate}</td>
                      <td style={{ ...td, color: '#9ca3af' }}>Year {u.years}</td>
                      <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isUrgent ? '#92400e30' : '#1e2130', color: isUrgent ? '#f59e0b' : '#9ca3af' }}>{u.daysUntil === 0 ? 'Today!' : `${u.daysUntil}d`}</span></td>
                      <td style={td}><button onClick={() => copyReminder(u)} style={{ padding: '5px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 6, background: reminderCopied === u.id ? '#0d2b1f' : 'transparent', color: reminderCopied === u.id ? '#34d399' : '#6b7280', border: `1px solid ${reminderCopied === u.id ? '#1a4a35' : '#2a2d3e'}` }}>{reminderCopied === u.id ? '✓ Copied' : '📋 Copy Reminder'}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  function renderUsers() {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Users</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Manage roles, manager assignments, start dates, and access.</p>
          </div>
          <button onClick={() => { setShowInviteModal(true); setInviteLink('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            <Plus size={14} /> Invite User
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…" style={{ ...inp, maxWidth: 280 }} />
          <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} style={{ ...inp, maxWidth: 150, appearance: 'none' }}>
            <option value="all">All roles</option>
            {['admin', 'dev_admin', 'manager', 'employee', 'pending'].map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
        </div>

        {/* Users table */}
        <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name / Email', 'Role', 'Position', 'Manager', 'Start Date', 'Self-Assessment', 'Status', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5, background: i % 2 === 0 ? 'transparent' : 'rgba(13,15,26,0.4)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {u.name || '—'}
                      {u.id === currentUser.id && <span style={{ fontSize: 10, color: '#818cf8' }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{u.email}</div>
                  </td>
                  <td style={td}>
                    {editingUser === u.id ? (
                      <select defaultValue={u.role} onChange={e => updateField(u.id, { role: e.target.value })} onBlur={() => setEditingUser(null)} autoFocus
                        style={{ background: '#0d0f1a', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                        {editRoleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => { const cantEdit = u.id === currentUser.id || (isDevAdmin && (u.role === 'admin' || u.role === 'dev_admin')); if (!cantEdit) setEditingUser(u.id) }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${ROLE_COLORS[u.role] ?? '#64748b'}18`, color: ROLE_COLORS[u.role] ?? '#64748b', cursor: u.id !== currentUser.id ? 'pointer' : 'default' }}
                        title={u.id !== currentUser.id ? 'Click to edit' : ''}>
                        {ROLE_LABELS[u.role] || u.role}
                        {u.id !== currentUser.id && !(isDevAdmin && (u.role === 'admin' || u.role === 'dev_admin')) && <span style={{ fontSize: 9 }}>✏️</span>}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    {editingPosition === u.id ? (
                      <input
                        defaultValue={u.position ?? ''}
                        onBlur={e => { updateField(u.id, { position: e.target.value || null }); setEditingPosition(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingPosition(null) }}
                        autoFocus
                        placeholder="e.g. Video Editor"
                        style={{ background: '#0d0f1a', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 140 }}
                      />
                    ) : (
                      <span onClick={() => setEditingPosition(u.id)}
                        style={{ fontSize: 12, color: u.position ? '#9ca3af' : '#374151', cursor: 'pointer' }}
                        title="Click to set position">
                        {u.position || <span style={{ color: '#f59e0b', fontSize: 11 }}>No position ✏️</span>}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    {editingManager === u.id ? (
                      <select defaultValue={u.manager_id ?? ''} onChange={e => updateField(u.id, { manager_id: e.target.value || null })} onBlur={() => setEditingManager(null)} autoFocus
                        style={{ background: '#0d0f1a', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                        <option value="">— None —</option>
                        {managers.filter(m => m.id !== u.id).map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => u.role === 'employee' && setEditingManager(u.id)}
                        style={{ fontSize: 12, color: u.manager_id ? '#9ca3af' : '#374151', cursor: u.role === 'employee' ? 'pointer' : 'default' }}
                        title={u.role === 'employee' ? 'Click to assign manager' : ''}>
                        {u.manager_id ? (users.find(m => m.id === u.manager_id)?.name || users.find(m => m.id === u.manager_id)?.email || '—') : (u.role === 'employee' ? <span style={{ color: '#f59e0b', fontSize: 11 }}>Unassigned ✏️</span> : '—')}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    {editingStartDate === u.id ? (
                      <input type="date" defaultValue={u.start_date ?? ''} onBlur={e => updateField(u.id, { start_date: e.target.value || null })} autoFocus
                        style={{ background: '#0d0f1a', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
                    ) : (
                      <span onClick={() => setEditingStartDate(u.id)} style={{ fontSize: 12, cursor: 'pointer', color: u.start_date ? '#9ca3af' : '#374151' }} title="Click to set start date">
                        {u.start_date ? new Date(u.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span style={{ color: '#f59e0b', fontSize: 11 }}>No date ✏️</span>}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    {u.role === 'employee' ? (
                      saMap[u.id] ? (
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: saMap[u.id].status === 'submitted' ? '#0d2b1f' : '#1e1f3a', color: saMap[u.id].status === 'submitted' ? '#34d399' : '#818cf8' }}>
                          {saMap[u.id].status === 'submitted' ? '✓ Submitted' : 'Draft'}
                        </span>
                      ) : <span style={{ fontSize: 11, color: '#374151' }}>Not started</span>
                    ) : <span style={{ color: '#2a2d3e' }}>—</span>}
                  </td>
                  <td style={td}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: u.is_active ? '#0d2b1f' : '#1f1c0d', color: u.is_active ? '#34d399' : '#f59e0b' }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {saMap[u.id]?.status === 'submitted' && (
                        <button onClick={() => openSA(u.id, u.name || u.email, u.position)} style={{ padding: '4px 10px', fontSize: 11, background: '#13151f', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 6, cursor: 'pointer' }}>
                          📋 View SA
                        </button>
                      )}
                      {u.id !== currentUser.id && (
                        <button onClick={() => toggleActive(u.id, u.is_active)} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', color: u.is_active ? '#f87171' : '#34d399', border: `1px solid ${u.is_active ? '#5c2020' : '#0d2b1f'}`, borderRadius: 6, cursor: 'pointer' }}>
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pending Invites */}
        <div style={{ fontWeight: 600, fontSize: 13, color: '#f0f2fa', marginBottom: 12 }}>Pending Invites ({invites.length})</div>
        <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
          {invites.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>No pending invites</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Email', 'Role', 'Invited', 'Expires'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ ...td, color: '#e5e7eb' }}>{inv.email}</td>
                    <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${ROLE_COLORS[inv.role] ?? '#64748b'}18`, color: ROLE_COLORS[inv.role] ?? '#64748b' }}>{ROLE_LABELS[inv.role] ?? inv.role}</span></td>
                    <td style={{ ...td, color: '#6b7280' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{new Date(inv.expires_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  function renderReviews() {
    // Unique managers who have reviews
    const reviewManagers = Array.from(new Set(reviews.map(r => r.user_id)))
      .map(id => users.find(u => u.id === id))
      .filter(Boolean) as UserRecord[]

    const counts = {
      total:       reviews.length,
      exported:    reviews.filter(r => reviewStatus(r) === 'exported').length,
      complete:    reviews.filter(r => reviewStatus(r) === 'complete').length,
      in_progress: reviews.filter(r => reviewStatus(r) === 'in_progress').length,
      not_started: reviews.filter(r => reviewStatus(r) === 'not_started').length,
    }

    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>Reviews</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>All manager performance reviews across the organization.</p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total',       value: counts.total,       color: '#f0f2fa', bg: '#13151f', border: '#1e2130',  filter: 'all'         },
            { label: 'Exported',    value: counts.exported,    color: STATUS_META.exported.color,    bg: STATUS_META.exported.bg,    border: STATUS_META.exported.border,    filter: 'exported'    },
            { label: 'Complete',    value: counts.complete,    color: STATUS_META.complete.color,    bg: STATUS_META.complete.bg,    border: STATUS_META.complete.border,    filter: 'complete'    },
            { label: 'In Progress', value: counts.in_progress, color: STATUS_META.in_progress.color, bg: STATUS_META.in_progress.bg, border: STATUS_META.in_progress.border, filter: 'in_progress' },
            { label: 'Not Started', value: counts.not_started, color: '#6b7280',                    bg: '#13151f',                  border: '#1e2130',                      filter: 'not_started' },
          ].map(s => (
            <div key={s.label} onClick={() => setReviewStatusFilter(s.filter as typeof reviewStatusFilter)}
              style={{ background: s.bg, border: `1px solid ${reviewStatusFilter === s.filter ? s.color + '60' : s.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s', outline: reviewStatusFilter === s.filter ? `1px solid ${s.color}40` : 'none' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={reviewSearch} onChange={e => setReviewSearch(e.target.value)} placeholder="Search by employee or position…"
            style={{ ...inp, maxWidth: 280 }} />
          <select value={reviewManagerFilter} onChange={e => setReviewManagerFilter(e.target.value)}
            style={{ ...inp, maxWidth: 200, appearance: 'none' }}>
            <option value="all">All managers</option>
            {reviewManagers.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
          {(reviewSearch || reviewStatusFilter !== 'all' || reviewManagerFilter !== 'all') && (
            <button onClick={() => { setReviewSearch(''); setReviewStatusFilter('all'); setReviewManagerFilter('all') }}
              style={{ padding: '8px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              Clear filters
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#4b5563', alignSelf: 'center' }}>
            {filteredReviews.length} of {reviews.length} reviews
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
          {filteredReviews.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📝</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>No reviews found</div>
              <div style={{ fontSize: 12 }}>{reviews.length === 0 ? 'No performance reviews have been created yet.' : 'Try adjusting your filters.'}</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Employee', 'Position', 'Manager', 'Progress', 'Status', 'Signatures', 'Drive', 'Comparison', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredReviews.map((r, i) => {
                  const pct = reviewProgress(r)
                  const status = reviewStatus(r)
                  const sm = STATUS_META[status]
                  const manager = users.find(u => u.id === r.user_id)
                  const isDeleting = deleteConfirm === r.id
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(13,15,26,0.4)' }}>

                      {/* Employee */}
                      <td style={td}>
                        <div style={{ fontWeight: 500, color: '#e5e7eb' }}>{r.employee_name || '—'}</div>
                      </td>

                      {/* Position */}
                      <td style={{ ...td, color: '#9ca3af', fontSize: 12 }}>{r.employee_position || '—'}</td>

                      {/* Manager */}
                      <td style={td}>
                        {manager ? (
                          <div>
                            <div style={{ fontSize: 12, color: '#c4c9d4' }}>{manager.name || manager.email}</div>
                            {manager.name && <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{manager.email}</div>}
                          </div>
                        ) : <span style={{ fontSize: 12, color: '#374151' }}>Unknown</span>}
                      </td>

                      {/* Progress bar */}
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, height: 5, background: '#1e2130', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#34d399' : '#4f46e5', borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#6b7280', minWidth: 28 }}>{pct}%</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#374151', marginTop: 3 }}>Step {Math.min(r.max_step, TOTAL_CONTENT_STEPS)}/{TOTAL_CONTENT_STEPS}</div>
                      </td>

                      {/* Status badge */}
                      <td style={td}>
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                          {sm.label}
                        </span>
                      </td>

                      {/* Signatures */}
                      <td style={td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: r.manager_signed_at ? '#34d399' : '#4b5563' }}>
                            {r.manager_signed_at ? `✓ Mgr ${new Date(r.manager_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '— Manager'}
                          </span>
                          <span style={{ fontSize: 11, color: r.employee_signed_at ? '#34d399' : '#4b5563' }}>
                            {r.employee_signed_at ? `✓ Emp ${new Date(r.employee_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '— Employee'}
                          </span>
                        </div>
                      </td>

                      {/* Drive link */}
                      <td style={td}>
                        {r.drive_url ? (
                          <a href={r.drive_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#0d1a13', color: '#34d399', borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none', border: '1px solid #1a4a35' }}>
                            <ExternalLink size={10} /> Open
                          </a>
                        ) : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}
                      </td>

                      {/* Comparison report */}
                      <td style={td}>
                        {isDevAdmin ? (
                          <span style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>Hidden</span>
                        ) : r.comparison_report ? (
                          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#1e1f3a', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}>✓ Generated</span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#374151' }}>—</span>
                        )}
                      </td>

                      {/* Last updated */}
                      <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>
                        {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td style={td}>
                        {isDeleting ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#f87171' }}>Delete?</span>
                            <button onClick={() => deleteReview(r.id)} disabled={deleting}
                              style={{ padding: '3px 8px', fontSize: 11, background: '#5c2020', color: '#f87171', border: '1px solid #7c2020', borderRadius: 5, cursor: 'pointer' }}>
                              {deleting ? '…' : 'Yes'}
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 5, cursor: 'pointer' }}>
                              No
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {!isDevAdmin && (
                              <button onClick={() => setDeleteConfirm(r.id)}
                                style={{ padding: '4px 9px', fontSize: 11, background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3a', borderRadius: 5, cursor: 'pointer' }}>
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Export CSV */}
        {!isDevAdmin && reviews.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => {
              const rows = [['Employee', 'Position', 'Manager', 'Progress', 'Status', 'Drive URL', 'Has Comparison', 'Last Updated']]
              filteredReviews.forEach(r => {
                const mgr = users.find(u => u.id === r.user_id)
                rows.push([
                  r.employee_name, r.employee_position,
                  mgr ? (mgr.name || mgr.email) : '',
                  `${reviewProgress(r)}%`, STATUS_META[reviewStatus(r)].label,
                  r.drive_url || '', r.comparison_report ? 'Yes' : 'No',
                  new Date(r.updated_at).toLocaleDateString(),
                ])
              })
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
              const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'reviews-export.csv'; a.click()
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#13151f', color: '#9ca3af', border: '1px solid #1e2130', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↓ Export CSV ({filteredReviews.length} rows)
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderPlaceholder(title: string, description: string, icon: string, items: string[]) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#f0f2fa' }}>{title}</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>{description}</p>
        <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>{title} — Coming Soon</div>
          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
            This section will include:
          </p>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280' }}>
                <span style={{ color: '#4f46e5', fontSize: 10 }}>▸</span> {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#f0f2fa', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: collapsed ? 56 : 240, flexShrink: 0, background: '#0d0f1a', borderRight: '1px solid #1e2130', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden' }}>

        {/* Logo */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: collapsed ? '0 12px' : '0 16px', borderBottom: '1px solid #1e2130', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#f0f2fa', whiteSpace: 'nowrap' }}>Performance Review</span>
              <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: isDevAdmin ? '#4a2060' : '#1e1f3a', color: isDevAdmin ? '#f472b6' : '#818cf8', whiteSpace: 'nowrap' }}>{isDevAdmin ? 'DEV' : 'ADMIN'}</span>
            </div>
          )}
          {collapsed && <span style={{ fontSize: 16 }}>📋</span>}
          <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 8px 6px', marginBottom: 2 }}>Menu</div>}
          {NAV.map(item => {
            const active = page === item.id
            const Icon = item.icon
            const badge = item.id === 'dashboard' ? notifCount : item.id === 'users' ? invites.length : 0
            return (
              <button key={item.id} onClick={() => setPage(item.id)} title={collapsed ? item.label : undefined}
                style={navBtn(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#13151f' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <Icon size={15} color={active ? '#818cf8' : '#6b7280'} />
                {!collapsed && item.label}
                {badge > 0 && !collapsed && (
                  <span style={{ marginLeft: 'auto', background: item.id === 'dashboard' && urgentCount > 0 ? '#f59e0b' : '#4f46e5', color: item.id === 'dashboard' && urgentCount > 0 ? '#0d0f1a' : 'white', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px' }}>{badge}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1e2130', padding: '8px', flexShrink: 0 }}>
          {!isDevAdmin && (
            <a href="/performance-review" title={collapsed ? 'Manager View' : undefined}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', borderRadius: 8, background: 'transparent', color: '#9ca3af', fontSize: 12, fontWeight: 500, textDecoration: 'none', marginBottom: 2, justifyContent: collapsed ? 'center' : 'flex-start' }}
              onMouseEnter={e => e.currentTarget.style.background = '#13151f'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ExternalLink size={14} color="#6b7280" />
              {!collapsed && 'Manager View'}
            </a>
          )}
          <div title={collapsed ? (currentUser.email) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: isDevAdmin ? 'linear-gradient(135deg,#9333ea,#db2777)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {currentUser.email.charAt(0).toUpperCase()}
            </div>
            {!collapsed && <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</span>}
          </div>
          <button onClick={signOut} title={collapsed ? 'Sign out' : undefined}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? '8px' : '8px 8px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 12, justifyContent: collapsed ? 'center' : 'flex-start' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a1010'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280' }}>
            <LogOut size={14} />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0b0d14' }}>

        {/* Dev Admin banner */}
        {isDevAdmin && (
          <div style={{ background: '#1e1a2e', borderBottom: '1px solid #4a2060', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#f472b6', fontSize: 14 }}>🔒</span>
            <span style={{ color: '#c084fc', fontSize: 12 }}>
              <strong>Dev Admin view</strong> — Sensitive review content is hidden. You can manage users, org structure, and system configuration.
            </span>
          </div>
        )}

        {page === 'dashboard' && renderDashboard()}
        {page === 'users'     && renderUsers()}

        {page === 'reviews' && renderReviews()}

        {page === 'cycles' && renderPlaceholder(
          'Review Cycles', 'Define and manage organization-wide review windows.',
          '🔄', [
            'Create named review cycles (e.g. "2025 Annual Review")',
            'Set open and close dates for self-assessment submission',
            'Publish cycles to notify all employees',
            'Track completion rates per cycle',
            'Close cycles and archive completed reviews',
          ]
        )}

        {page === 'analytics' && renderPlaceholder(
          'Analytics', 'Organization-wide performance data and reporting.',
          '📊', [
            'Overall rating distribution across the org',
            'Completion rates by team and review cycle',
            'Self-assessment submission tracking',
            'Manager review velocity (time to complete)',
            'Export raw data to CSV',
            'Year-over-year trend comparisons',
          ]
        )}

        {page === 'audit' && renderPlaceholder(
          'Audit Log', 'Full activity trail for compliance and security.',
          '📋', [
            'All user creation, role, and deactivation events',
            'Review submission and reopen events',
            'Drive export activity',
            'Login and session events',
            'Admin configuration changes',
            'Filterable by date range, actor, and action type',
          ]
        )}

        {page === 'settings' && renderPlaceholder(
          'Settings', 'Configure system-wide settings, Drive integration, and review templates.',
          '⚙️', [
            'Google Drive folder URL for manager reviews',
            'Review template management (competency frameworks)',
            'Self-assessment unlock/lock controls',
            'AI draft tool access per role',
            'Notification and reminder settings',
            'Organization name and branding',
          ]
        )}
      </main>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget) setShowInviteModal(false) }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: '32px', width: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f0f2fa' }}>Invite User</h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>An invitation email will be sent. They sign in with their Google account.</p>

            {inviteLink ? (
              <>
                <div style={{ background: inviteEmailSent ? '#0d2b1f' : '#1e1f3a', border: `1px solid ${inviteEmailSent ? '#1a4a35' : '#2d2f5e'}`, borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: inviteEmailSent ? '#34d399' : '#818cf8', marginBottom: 6 }}>
                    {inviteEmailSent ? '✓ Invitation email sent!' : '✓ Invite created'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    {inviteEmailSent ? `An email was sent to ${inviteEmail} with their invite link.` : 'Copy and share this link manually:'}
                  </div>
                  {!inviteEmailSent && (
                    <div style={{ marginTop: 10, background: '#0d0f1a', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#6b7280', wordBreak: 'break-all', lineHeight: 1.6 }}>{inviteLink}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!inviteEmailSent && <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ flex: 1, padding: '10px', background: '#1e2130', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Copy Link</button>}
                  <button onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteLink(''); setInviteManagerId(''); setInvitePosition(''); setInviteStartDate(''); setInviteEmailSent(false) }}
                    style={{ flex: 1, padding: '10px', background: inviteEmailSent ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent', color: inviteEmailSent ? '#fff' : '#6b7280', border: inviteEmailSent ? 'none' : '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, fontWeight: inviteEmailSent ? 600 : 400, cursor: 'pointer' }}>Done</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Email address</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@company.com" autoFocus style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {inviteRoleOptions.map(r => (
                      <button key={r} onClick={() => { setInviteRole(r); if (r !== 'employee') setInviteManagerId('') }}
                        style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: inviteRole === r ? `${ROLE_COLORS[r]}20` : '#0d1117', color: inviteRole === r ? ROLE_COLORS[r] : '#6b7280', outline: inviteRole === r ? `1.5px solid ${ROLE_COLORS[r]}` : '1px solid #2a2d3e' }}>
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
                {inviteRole === 'employee' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>Assign Manager <span style={{ color: '#374151', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <select value={inviteManagerId} onChange={e => setInviteManagerId(e.target.value)} style={inp}>
                      <option value="">— Assign later —</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>Position <span style={{ color: '#374151', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <input value={invitePosition} onChange={e => setInvitePosition(e.target.value)} placeholder="e.g. Video Editor" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Start Date <span style={{ color: '#374151', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <input type="date" value={inviteStartDate} onChange={e => setInviteStartDate(e.target.value)} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteManagerId(''); setInvitePosition(''); setInviteStartDate('') }} style={{ flex: 1, padding: '11px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={sendInvite} disabled={!inviteEmail || inviteLoading}
                    style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !inviteEmail || inviteLoading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {inviteLoading ? 'Sending…' : '✉️ Send Invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SA Viewer Modal ── */}
      {viewingSA && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setViewingSA(null) }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
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
            <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
              {saLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
              ) : !saData ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No submitted self-assessment found.</div>
              ) : (
                <>
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
                            {c.examples.filter((e: string) => e.trim()).map((ex: string, ei: number) => (
                              <div key={ei} style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #1e2130' }}>{ex}</div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {saData.goals_objectives?.filter((g: {description:string}) => g.description.trim()).length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Goals & Objectives</div>
                      {saData.goals_objectives.filter((g: {description:string}) => g.description.trim()).map((g: {description:string;outcome:string;reasoning:string}, i: number) => (
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
                  {saData.next_year_goals?.filter((g: {goal:string}) => g.goal.trim()).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Next Year&apos;s Goals</div>
                      {saData.next_year_goals.filter((g: {goal:string}) => g.goal.trim()).map((g: {goal:string;objective:string}, i: number) => (
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
    </div>
  )
}
