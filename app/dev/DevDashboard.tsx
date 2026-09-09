'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type UserRecord = {
  id: string; name: string | null; email: string; role: string
  is_active: boolean; manager_id: string | null; start_date: string | null; created_at: string
}
type InviteRecord = {
  id: string; email: string; role: string; created_at: string; expires_at: string; accepted_at: string | null
}
type AuditLog = {
  id: string; action: string; actor_user_id: string; target_type: string; created_at: string
}
type Props = {
  currentUser: { id: string; email: string; role: string }
  stats: { reviewCount: number; selfReviewCount: number; userCount: number }
  recentAuditLogs: AuditLog[]
  users: UserRecord[]
  invites: InviteRecord[]
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'var(--brand)', dev_admin: 'var(--danger)', manager: 'var(--success)', employee: 'var(--info)', pending: 'var(--warning)',
}
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', dev_admin: 'Dev Admin', manager: 'Manager', employee: 'Employee', pending: 'Pending',
}

export default function DevDashboard({ currentUser, stats, recentAuditLogs, users, invites }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs' | 'system'>('overview')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'employee'>('employee')
  const [inviteManagerId, setInviteManagerId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin')

  async function handleRoleChange(userId: string) {
    if (!['manager', 'employee'].includes(editRole)) {
      alert('Dev Admin can only assign manager or employee roles.')
      return
    }
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: editRole }),
    })
    setSaving(false)
    setEditingUser(null)
    router.refresh()
  }

  async function handleDeactivate(userId: string, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_active: !isActive }),
    })
    router.refresh()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        managerId: inviteRole === 'employee' ? inviteManagerId : undefined,
      }),
    })
    setInviteLoading(false)
    setShowInviteModal(false)
    setInviteEmail('')
    router.refresh()
  }

  const pill = (color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-pill)',
    background: color + '22', color, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
  })
  const tab = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
    background: active ? 'var(--brand)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', fontWeight: 600, fontSize: 14,
  })
  const card: React.CSSProperties = {
    background: 'var(--surface-raised)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', border: '1px solid var(--info-border)',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page)', color: 'var(--text)', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--info-border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-strong)' }}>Dev Admin Console</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{currentUser.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={pill('var(--danger)')}>Dev Admin</span>
          <button onClick={() => router.push('/admin')}
            style={{ padding: '6px 14px', background: 'var(--surface-raised)', color: 'var(--brand-text)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Admin View
          </button>
          <button
            onClick={async () => { await fetch('/api/auth/signout', { method: 'POST' }); router.push('/login') }}
            style={{ padding: '6px 14px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content restriction banner */}
      <div style={{ background: 'var(--brand-tint)', borderBottom: '1px solid var(--brand-tint)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--danger)', fontSize: 14 }}>🔒</span>
        <span style={{ color: 'var(--brand-text)', fontSize: 13 }}>
          <strong>Dev Admin access:</strong> Review document content is hidden for this role. You can see metadata, system stats, users, and audit logs only.
        </span>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
          {(['overview', 'users', 'logs', 'system'] as const).map(t => (
            <button key={t} style={tab(activeTab === t)} onClick={() => setActiveTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'users' ? 'Users' : t === 'logs' ? 'Audit Logs' : 'System'}
            </button>
          ))}
          <button onClick={() => setShowInviteModal(true)}
            style={{ marginLeft: 'auto', padding: '8px 16px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            + Invite User
          </button>
        </div>

        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Active Users', value: stats.userCount },
                { label: 'Reviews (metadata only)', value: stats.reviewCount },
                { label: 'Self Assessments (metadata only)', value: stats.selfReviewCount },
              ].map(s => (
                <div key={s.label} style={card}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-strong)' }}>{s.value}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--text-strong)' }}>Recent Audit Events</div>
              {recentAuditLogs.length === 0 ? (
                <div style={{ color: 'var(--text-faint)' }}>No audit logs yet.</div>
              ) : recentAuditLogs.slice(0, 10).map(log => (
                <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--info-border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text)' }}>{log.action}</strong> on {log.target_type}</span>
                  <span style={{ color: 'var(--text-faint)' }}>{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--text-strong)' }}>User Management</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--info-border)' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-strong)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{u.name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {editingUser === u.id ? (
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            style={{ background: 'var(--page)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                            <option value="manager">Manager</option>
                            <option value="employee">Employee</option>
                          </select>
                        ) : (
                          <span style={pill(ROLE_COLORS[u.role] ?? 'var(--text-muted)')}>{ROLE_LABELS[u.role] ?? u.role}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={pill(u.is_active ? 'var(--success)' : 'var(--danger)')}>{u.is_active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {u.role !== 'admin' && u.role !== 'dev_admin' && (
                            editingUser === u.id ? (
                              <>
                                <button onClick={() => handleRoleChange(u.id)} disabled={saving}
                                  style={{ padding: '4px 10px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12 }}>
                                  {saving ? '...' : 'Save'}
                                </button>
                                <button onClick={() => setEditingUser(null)}
                                  style={{ padding: '4px 10px', background: 'var(--surface-raised)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12 }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button onClick={() => { setEditingUser(u.id); setEditRole(u.role) }}
                                style={{ padding: '4px 10px', background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12 }}>
                                Edit Role
                              </button>
                            )
                          )}
                          {u.id !== currentUser.id && (
                            <button onClick={() => handleDeactivate(u.id, u.is_active)}
                              style={{ padding: '4px 10px', background: u.is_active ? 'var(--danger-border)' : 'var(--success-text)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12 }}>
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
          </div>
        )}

        {activeTab === 'logs' && (
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--text-strong)' }}>Audit Logs (Technical)</div>
            {recentAuditLogs.length === 0 ? (
              <div style={{ color: 'var(--text-faint)' }}>No audit logs found.</div>
            ) : recentAuditLogs.map(log => (
              <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--info-border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: 'var(--text)' }}>{log.action}</strong>
                  <span style={{ color: 'var(--text-faint)' }}>{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Target: {log.target_type} · Actor: {log.actor_user_id}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'system' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { title: 'Integrations', items: ['Google Drive API', 'Google Docs API', 'Resend Email', 'Supabase Auth'] },
              { title: 'App Settings', items: ['Environment: Production', 'Auth: Google OAuth', 'DB: Supabase Postgres', 'AI: Gemini 2.0 Flash / Claude / GPT-4o'] },
              { title: 'Deployment', items: ['Platform: Vercel', 'Branch: main', 'Framework: Next.js'] },
              { title: 'Auth Config', items: ['Provider: Supabase', 'OAuth: Google', 'Consent screen: check Google Cloud Console'] },
            ].map(section => (
              <div key={section.title} style={card}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--text-strong)' }}>{section.title}</div>
                {section.items.map(item => (
                  <div key={item} style={{ padding: '6px 0', borderBottom: '1px solid var(--info-border)', fontSize: 13, color: 'var(--text-secondary)' }}>{item}</div>
                ))}
              </div>
            ))}
            <div style={{ ...card, gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--text-strong)' }}>Pending Invites ({invites.length})</div>
              {invites.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>No pending invites.</div>
              ) : invites.map(inv => (
                <div key={inv.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--info-border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text)' }}>{inv.email}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius-xl)', padding: 32, width: 420, border: '1px solid var(--info-border)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, color: 'var(--text-strong)' }}>Invite User</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>Dev Admin can invite Manager or Employee only.</p>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Email</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required type="email"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--page)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['employee', 'manager'] as const).map(r => (
                    <button type="button" key={r} onClick={() => setInviteRole(r)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)', border: '2px solid', borderColor: inviteRole === r ? 'var(--brand)' : 'var(--text-faint)', background: inviteRole === r ? '#6366f133' : 'transparent', color: inviteRole === r ? 'var(--brand-text)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {inviteRole === 'employee' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Manager (optional)</label>
                  <select value={inviteManagerId} onChange={e => setInviteManagerId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--page)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                    <option value="">No manager</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button type="submit" disabled={inviteLoading}
                  style={{ flex: 1, padding: '10px 0', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </button>
                <button type="button" onClick={() => setShowInviteModal(false)}
                  style={{ padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
