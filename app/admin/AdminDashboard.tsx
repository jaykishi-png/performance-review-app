'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type UserRecord = {
  id: string
  name: string | null
  email: string
  role: string
  is_active: boolean
  manager_id: string | null
  start_date: string | null
  created_at: string
}

type InviteRecord = {
  id: string; email: string; role: string
  created_at: string; expires_at: string; accepted_at: string | null
}

type SelfAssessmentStatus = { employee_id: string; status: string; submitted_at: string | null }

type Props = {
  currentUser: { id: string; email: string; role: 'admin' | 'dev_admin' }
  users: UserRecord[]
  invites: InviteRecord[]
  selfAssessments: SelfAssessmentStatus[]
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#818cf8', dev_admin: '#f472b6', manager: '#34d399', employee: '#60a5fa', pending: '#f59e0b',
}
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', dev_admin: 'Dev Admin', manager: 'Manager', employee: 'Employee', pending: 'Pending',
}

function daysUntilAnniversary(startDate: string): number {
  const start = new Date(startDate)
  const today = new Date()
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function anniversaryDate(startDate: string): string {
  const start = new Date(startDate)
  const today = new Date()
  const next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function yearsOfService(startDate: string): number {
  const start = new Date(startDate)
  const today = new Date()
  return today.getFullYear() - start.getFullYear()
}

export default function AdminDashboard({ currentUser, users, invites, selfAssessments }: Props) {
  const router = useRouter()
  const isDevAdmin = currentUser.role === 'dev_admin'

  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'upcoming'>('upcoming')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'employee'>('employee')
  const [inviteManagerId, setInviteManagerId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteEmailSent, setInviteEmailSent] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editingManager, setEditingManager] = useState<string | null>(null)
  const [editingStartDate, setEditingStartDate] = useState<string | null>(null)
  const [reminderCopied, setReminderCopied] = useState<string | null>(null)

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin')
  const saMap = Object.fromEntries(selfAssessments.map(s => [s.employee_id, s]))
  const activeUsers = users.filter(u => u.is_active)

  // Invite roles available depend on actor role
  const inviteRoleOptions = isDevAdmin
    ? (['employee', 'manager'] as const)
    : (['employee', 'manager', 'admin'] as const)

  // Role options in user edit dropdown depend on actor role
  const editRoleOptions = isDevAdmin
    ? ['manager', 'employee', 'pending']
    : ['admin', 'dev_admin', 'manager', 'employee', 'pending']

  const upcomingReviews = useMemo(() => {
    return users
      .filter(u => u.start_date && u.is_active && u.role !== 'pending')
      .map(u => ({ ...u, daysUntil: daysUntilAnniversary(u.start_date!), annDate: anniversaryDate(u.start_date!), years: yearsOfService(u.start_date!) + 1 }))
      .filter(u => u.daysUntil <= 90)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [users])

  const urgentCount = upcomingReviews.filter(u => u.daysUntil <= 30).length

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  async function sendInvite() {
    if (!inviteEmail) return
    // Guard: dev admin cannot send admin/dev_admin invites
    if (isDevAdmin && inviteRole === 'admin') return
    setInviteLoading(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          managerId: inviteRole === 'employee' ? inviteManagerId || null : null,
        }),
      })
      const data = await res.json()
      if (data.inviteLink) {
        setInviteLink(data.inviteLink)
        setInviteEmailSent(!!data.emailSent)
      }
      router.refresh()
    } finally { setInviteLoading(false) }
  }

  async function updateField(userId: string, fields: Record<string, unknown>) {
    // Guard: dev admin cannot set admin/dev_admin roles
    if (isDevAdmin && fields.role && ['admin', 'dev_admin'].includes(fields.role as string)) return
    await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...fields }),
    })
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

  const S = {
    th: { padding: '10px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #1e2130' },
    td: { padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #13151f' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#f0f2fa' }}>

      {/* Header */}
      <div style={{ background: '#0d0f1a', borderBottom: '1px solid #1e2130', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f0f2fa' }}>Performance Review</span>
          <span style={{ background: '#1e2130', padding: '3px 10px', borderRadius: 20, fontSize: 11, color: isDevAdmin ? '#f472b6' : '#818cf8', fontWeight: 600 }}>
            {isDevAdmin ? 'Dev Admin' : 'Admin'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDevAdmin && (
            <a href="/dev" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#1e1a2e', color: '#f472b6', border: '1px solid #4a2060', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
              ↗ Dev Console
            </a>
          )}
          {!isDevAdmin && (
            <a href="/performance-review" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#1e2130', color: '#9ca3af', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
              ↗ Manager View
            </a>
          )}
          <span style={{ fontSize: 12, color: '#6b7280' }}>{currentUser.email}</span>
          <button onClick={signOut} style={{ padding: '5px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Dev Admin notice banner */}
      {isDevAdmin && (
        <div style={{ background: '#1e1a2e', borderBottom: '1px solid #4a2060', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#f472b6', fontSize: 14 }}>🔒</span>
          <span style={{ color: '#c084fc', fontSize: 13 }}>
            <strong>Dev Admin view</strong> — Sensitive review document content is hidden for this role. You can manage users, org chart, and system settings.
          </span>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 28px' }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Users', value: activeUsers.length, color: '#f0f2fa' },
            { label: 'Managers', value: activeUsers.filter(u => u.role === 'manager').length, color: '#34d399' },
            { label: 'Employees', value: activeUsers.filter(u => u.role === 'employee').length, color: '#60a5fa' },
            { label: 'Reviews Due (90d)', value: upcomingReviews.length, color: urgentCount > 0 ? '#f59e0b' : '#f0f2fa', urgent: urgentCount > 0 },
            { label: 'Pending Access', value: users.filter(u => u.role === 'pending').length + invites.length, color: '#f0f2fa' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: '#13151f', border: `1px solid ${(s as {urgent?: boolean}).urgent ? '#92400e' : '#1e2130'}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs + invite button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 0, background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: 4 }}>
            {([
              { key: 'upcoming', label: `Upcoming Reviews${urgentCount > 0 ? ` (${urgentCount} urgent)` : ''}` },
              { key: 'users', label: `Users (${users.length})` },
              { key: 'invites', label: `Pending Invites (${invites.length})` },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: activeTab === tab.key ? '#1e2130' : 'transparent',
                color: activeTab === tab.key ? (tab.key === 'upcoming' && urgentCount > 0 ? '#f59e0b' : '#f0f2fa') : '#6b7280',
              }}>{tab.label}</button>
            ))}
          </div>
          <button onClick={() => { setShowInviteModal(true); setInviteLink('') }} style={{
            padding: '8px 18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>+ Invite User</button>
        </div>

        {/* ── Upcoming Reviews tab ── */}
        {activeTab === 'upcoming' && (
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
            {upcomingReviews.length === 0 ? (
              <div style={{ padding: '60px 32px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
                <div style={{ fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>No upcoming reviews in the next 90 days</div>
                <div style={{ fontSize: 12 }}>Add start dates to users in the Users tab to track anniversaries.</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Employee', 'Role', 'Manager', 'Review Date', 'Years', 'Days Away', 'Reminder'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingReviews.map(u => {
                    const isUrgent = u.daysUntil <= 30
                    const managerUser = u.manager_id ? users.find(m => m.id === u.manager_id) : null
                    return (
                      <tr key={u.id} style={{ background: isUrgent ? '#1a110a' : 'transparent' }}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 500, color: '#e5e7eb' }}>{u.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{u.email}</div>
                        </td>
                        <td style={S.td}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role] }}>
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>
                          {managerUser ? (managerUser.name || managerUser.email) : <span style={{ color: '#374151' }}>Unassigned</span>}
                        </td>
                        <td style={{ ...S.td, color: '#c4c9d4', fontWeight: 500 }}>{u.annDate}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>Year {u.years}</td>
                        <td style={S.td}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: isUrgent ? '#92400e30' : '#1e2130',
                            color: isUrgent ? '#f59e0b' : '#9ca3af',
                          }}>
                            {u.daysUntil === 0 ? 'Today!' : `${u.daysUntil}d`}
                          </span>
                        </td>
                        <td style={S.td}>
                          <button onClick={() => copyReminder(u)} style={{
                            padding: '5px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                            background: reminderCopied === u.id ? '#0d2b1f' : 'transparent',
                            color: reminderCopied === u.id ? '#34d399' : '#6b7280',
                            border: `1px solid ${reminderCopied === u.id ? '#1a4a35' : '#2a2d3e'}`,
                          }}>
                            {reminderCopied === u.id ? '✓ Copied' : '📋 Copy Reminder'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {activeTab === 'users' && (
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Name / Email', 'Role', 'Manager', 'Start Date', 'Self-Assessment', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5, background: i % 2 === 0 ? 'transparent' : '#0d0f1a10' }}>
                    {/* Name */}
                    <td style={S.td}>
                      <div style={{ fontWeight: 500, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name || '—'}
                        {u.id === currentUser.id && <span style={{ fontSize: 10, color: '#818cf8' }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{u.email}</div>
                    </td>

                    {/* Role */}
                    <td style={S.td}>
                      {editingUser === u.id ? (
                        <select defaultValue={u.role} onChange={e => updateField(u.id, { role: e.target.value })} onBlur={() => setEditingUser(null)} autoFocus
                          style={{ background: '#0d0f1a', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                          {editRoleOptions.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => {
                            // Cannot edit own role, admin/dev_admin roles if dev_admin
                            const cantEdit = u.id === currentUser.id || (isDevAdmin && (u.role === 'admin' || u.role === 'dev_admin'))
                            if (!cantEdit) setEditingUser(u.id)
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${ROLE_COLORS[u.role] ?? '#64748b'}18`, color: ROLE_COLORS[u.role] ?? '#64748b', cursor: u.id !== currentUser.id ? 'pointer' : 'default' }}
                          title={u.id !== currentUser.id ? 'Click to edit' : ''}>
                          {ROLE_LABELS[u.role] || u.role}
                          {u.id !== currentUser.id && !(isDevAdmin && (u.role === 'admin' || u.role === 'dev_admin')) && <span style={{ fontSize: 9 }}>✏️</span>}
                        </span>
                      )}
                    </td>

                    {/* Manager */}
                    <td style={S.td}>
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

                    {/* Start Date */}
                    <td style={S.td}>
                      {editingStartDate === u.id ? (
                        <input type="date" defaultValue={u.start_date ?? ''} onBlur={e => updateField(u.id, { start_date: e.target.value || null })} autoFocus
                          style={{ background: '#0d0f1a', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
                      ) : (
                        <span onClick={() => setEditingStartDate(u.id)}
                          style={{ fontSize: 12, cursor: 'pointer', color: u.start_date ? '#9ca3af' : '#374151' }}
                          title="Click to set start date">
                          {u.start_date ? new Date(u.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span style={{ color: '#f59e0b', fontSize: 11 }}>No date ✏️</span>}
                        </span>
                      )}
                    </td>

                    {/* Self-Assessment */}
                    <td style={S.td}>
                      {u.role === 'employee' ? (
                        saMap[u.id] ? (
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: saMap[u.id].status === 'submitted' ? '#0d2b1f' : '#1e1f3a', color: saMap[u.id].status === 'submitted' ? '#34d399' : '#818cf8' }}>
                            {saMap[u.id].status === 'submitted' ? '✓ Submitted' : 'Draft'}
                          </span>
                        ) : <span style={{ fontSize: 11, color: '#374151' }}>Not started</span>
                      ) : <span style={{ color: '#2a2d3e' }}>—</span>}
                    </td>

                    {/* Status */}
                    <td style={S.td}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: u.is_active ? '#0d2b1f' : '#1f1c0d', color: u.is_active ? '#34d399' : '#f59e0b' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={S.td}>
                      {u.id !== currentUser.id && (
                        <button onClick={() => toggleActive(u.id, u.is_active)} style={{
                          padding: '4px 10px', fontSize: 11, background: 'transparent',
                          color: u.is_active ? '#f87171' : '#34d399',
                          border: `1px solid ${u.is_active ? '#5c2020' : '#0d2b1f'}`,
                          borderRadius: 6, cursor: 'pointer',
                        }}>
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pending Invites tab ── */}
        {activeTab === 'invites' && (
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
            {invites.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No pending invites</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Email', 'Role', 'Invited', 'Expires'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {invites.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ ...S.td, color: '#e5e7eb' }}>{inv.email}</td>
                      <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${ROLE_COLORS[inv.role] ?? '#64748b'}18`, color: ROLE_COLORS[inv.role] ?? '#64748b' }}>{ROLE_LABELS[inv.role] ?? inv.role}</span></td>
                      <td style={{ ...S.td, color: '#6b7280' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td style={{ ...S.td, color: '#6b7280' }}>{new Date(inv.expires_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setShowInviteModal(false) }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: '32px', width: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f0f2fa' }}>Invite User</h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>
              An invitation email will be sent. They sign in with their Google account.
            </p>

            {inviteLink ? (
              <>
                <div style={{ background: inviteEmailSent ? '#0d2b1f' : '#1e1f3a', border: `1px solid ${inviteEmailSent ? '#1a4a35' : '#2d2f5e'}`, borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: inviteEmailSent ? '#34d399' : '#818cf8', marginBottom: 6 }}>
                    {inviteEmailSent ? '✓ Invitation email sent!' : '✓ Invite created'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    {inviteEmailSent
                      ? `An email was sent to ${inviteEmail} with their invite link.`
                      : 'Copy and share this link manually:'}
                  </div>
                  {!inviteEmailSent && (
                    <div style={{ marginTop: 10, background: '#0d0f1a', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#6b7280', wordBreak: 'break-all', lineHeight: 1.6 }}>
                      {inviteLink}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!inviteEmailSent && (
                    <button onClick={() => navigator.clipboard.writeText(inviteLink)}
                      style={{ flex: 1, padding: '10px', background: '#1e2130', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                      Copy Link
                    </button>
                  )}
                  <button onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteLink(''); setInviteManagerId(''); setInviteEmailSent(false) }}
                    style={{ flex: 1, padding: '10px', background: inviteEmailSent ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent', color: inviteEmailSent ? '#fff' : '#6b7280', border: inviteEmailSent ? 'none' : '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, fontWeight: inviteEmailSent ? 600 : 400, cursor: 'pointer' }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email address</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="name@company.com" autoFocus
                    style={{ width: '100%', padding: '10px 12px', background: '#0d1117', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' }} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {inviteRoleOptions.map(r => (
                      <button key={r} onClick={() => { setInviteRole(r); if (r !== 'employee') setInviteManagerId('') }}
                        style={{
                          flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          background: inviteRole === r ? `${ROLE_COLORS[r]}20` : '#0d1117',
                          color: inviteRole === r ? ROLE_COLORS[r] : '#6b7280',
                          outline: inviteRole === r ? `1.5px solid ${ROLE_COLORS[r]}` : '1px solid #2a2d3e',
                        }}>
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {inviteRole === 'employee' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Assign Manager <span style={{ color: '#374151', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                    </label>
                    <select value={inviteManagerId} onChange={e => setInviteManagerId(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: '#0d1117', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13 }}>
                      <option value="">— Assign later —</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.name || m.email}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteManagerId('') }}
                    style={{ flex: 1, padding: '11px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={sendInvite} disabled={!inviteEmail || inviteLoading}
                    style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !inviteEmail || inviteLoading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {inviteLoading ? 'Sending…' : '✉️ Send Invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
