'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type UserRecord = {
  id: string
  name: string | null
  email: string
  role: string
  is_active: boolean
  manager_id: string | null
  created_at: string
}

type InviteRecord = {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

type SelfReviewStatus = { employee_id: string; status: string; submitted_at: string | null }

type Props = {
  currentUser: { id: string; email: string; role: string }
  users: UserRecord[]
  invites: InviteRecord[]
  selfReviews: SelfReviewStatus[]
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#818cf8',
  manager: '#34d399',
  employee: '#60a5fa',
  pending: '#f59e0b',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
  pending: 'Pending',
}

export default function AdminDashboard({ currentUser, users, invites, selfReviews }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'employee'>('employee')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editingManager, setEditingManager] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users')

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin')
  const srMap = Object.fromEntries(selfReviews.map(s => [s.employee_id, s]))

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function sendInvite() {
    if (!inviteEmail) return
    setInviteLoading(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (data.inviteLink) {
        setInviteLink(data.inviteLink)
      }
      router.refresh()
    } finally {
      setInviteLoading(false)
    }
  }

  async function updateRole(userId: string, newRole: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    setEditingUser(null)
    router.refresh()
  }

  async function updateManager(userId: string, managerId: string | null) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, manager_id: managerId }),
    })
    setEditingManager(null)
    router.refresh()
  }

  async function toggleActive(userId: string, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_active: !isActive }),
    })
    router.refresh()
  }

  const activeUsers = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0d14',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#f0f2fa',
    }}>
      {/* Header */}
      <div style={{
        background: '#13151f',
        borderBottom: '1px solid #1e2130',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>⭐</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Performance Review</span>
          <span style={{
            background: '#1e2130', padding: '3px 10px', borderRadius: 20,
            fontSize: 12, color: '#818cf8', fontWeight: 600,
          }}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{currentUser.email}</span>
          <button
            onClick={signOut}
            style={{
              padding: '6px 14px', background: 'transparent',
              color: '#6b7280', border: '1px solid #2a2d3e',
              borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 32px' }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Users', value: users.length },
            { label: 'Managers', value: users.filter(u => u.role === 'manager').length },
            { label: 'Employees', value: users.filter(u => u.role === 'employee').length },
            { label: 'Pending Access', value: users.filter(u => u.role === 'pending').length + invites.length },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, background: '#13151f', border: '1px solid #1e2130',
              borderRadius: 12, padding: '20px 24px',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f2fa', marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Invite button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 0, background: '#13151f', border: '1px solid #1e2130', borderRadius: 8, padding: 4 }}>
            {(['users', 'invites'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  background: activeTab === tab ? '#1e2130' : 'transparent',
                  color: activeTab === tab ? '#f0f2fa' : '#6b7280',
                }}
              >
                {tab === 'users' ? `Users (${users.length})` : `Pending Invites (${invites.length})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowInviteModal(true); setInviteLink('') }}
            style={{
              padding: '9px 20px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Invite User
          </button>
        </div>

        {/* Users table */}
        {activeTab === 'users' && (
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2130' }}>
                  {['Name / Email', 'Role', 'Manager', 'Self-Review', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '12px 20px', textAlign: 'left',
                      fontSize: 12, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...activeUsers, ...inactiveUsers].map((u, i) => (
                  <tr key={u.id} style={{
                    borderBottom: i < users.length - 1 ? '1px solid #1a1d2b' : 'none',
                    opacity: u.is_active ? 1 : 0.5,
                  }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#e5e7eb' }}>
                        {u.name || '—'}
                        {u.id === currentUser.id && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: '#6366f1' }}>(you)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {editingUser === u.id ? (
                        <select
                          defaultValue={u.role}
                          onChange={e => updateRole(u.id, e.target.value)}
                          onBlur={() => setEditingUser(null)}
                          autoFocus
                          style={{
                            background: '#1e2130', color: '#f0f2fa',
                            border: '1px solid #2a2d3e', borderRadius: 6,
                            padding: '4px 8px', fontSize: 13,
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                          <option value="pending">Pending</option>
                        </select>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: 12, fontWeight: 500,
                          background: `${ROLE_COLORS[u.role]}18`,
                          color: ROLE_COLORS[u.role] || '#6b7280',
                          cursor: u.id !== currentUser.id ? 'pointer' : 'default',
                        }}
                          onClick={() => u.id !== currentUser.id && setEditingUser(u.id)}
                          title={u.id !== currentUser.id ? 'Click to change role' : ''}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                          {u.id !== currentUser.id && <span style={{ fontSize: 10 }}>✏️</span>}
                        </span>
                      )}
                    </td>
                    {/* Manager assignment */}
                    <td style={{ padding: '14px 20px' }}>
                      {editingManager === u.id ? (
                        <select
                          defaultValue={u.manager_id ?? ''}
                          onChange={e => updateManager(u.id, e.target.value || null)}
                          onBlur={() => setEditingManager(null)}
                          autoFocus
                          style={{ background: '#1e2130', color: '#f0f2fa', border: '1px solid #2a2d3e', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                        >
                          <option value="">— None —</option>
                          {managers.filter(m => m.id !== u.id).map(m => (
                            <option key={m.id} value={m.id}>{m.name || m.email}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => u.role === 'employee' && setEditingManager(u.id)}
                          style={{ fontSize: 12, color: u.manager_id ? '#9ca3af' : '#374151', cursor: u.role === 'employee' ? 'pointer' : 'default' }}
                          title={u.role === 'employee' ? 'Click to assign manager' : ''}
                        >
                          {u.manager_id ? (users.find(m => m.id === u.manager_id)?.name || users.find(m => m.id === u.manager_id)?.email || '—') : (u.role === 'employee' ? <span style={{ color: '#f59e0b', fontSize: 11 }}>Unassigned ✏️</span> : '—')}
                        </span>
                      )}
                    </td>

                    {/* Self-review status */}
                    <td style={{ padding: '14px 20px' }}>
                      {u.role === 'employee' ? (
                        srMap[u.id] ? (
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: srMap[u.id].status === 'submitted' ? '#0d2b1f' : '#1e1f3a',
                            color: srMap[u.id].status === 'submitted' ? '#34d399' : '#818cf8',
                          }}>
                            {srMap[u.id].status === 'submitted' ? '✓ Submitted' : 'Draft'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#374151' }}>Not started</span>
                        )
                      ) : <span style={{ color: '#2a2d3e', fontSize: 12 }}>—</span>}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        background: u.is_active ? '#0d2b1f' : '#1f1c0d',
                        color: u.is_active ? '#34d399' : '#f59e0b',
                      }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          style={{
                            padding: '5px 12px', fontSize: 12,
                            background: 'transparent',
                            color: u.is_active ? '#f87171' : '#34d399',
                            border: `1px solid ${u.is_active ? '#5c2020' : '#0d2b1f'}`,
                            borderRadius: 6, cursor: 'pointer',
                          }}
                        >
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

        {/* Pending invites table */}
        {activeTab === 'invites' && (
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, overflow: 'hidden' }}>
            {invites.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                No pending invites
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2130' }}>
                    {['Email', 'Role', 'Invited', 'Expires'].map(h => (
                      <th key={h} style={{
                        padding: '12px 20px', textAlign: 'left',
                        fontSize: 12, fontWeight: 600, color: '#6b7280',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv, i) => (
                    <tr key={inv.id} style={{ borderBottom: i < invites.length - 1 ? '1px solid #1a1d2b' : 'none' }}>
                      <td style={{ padding: '14px 20px', fontSize: 14, color: '#e5e7eb' }}>{inv.email}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                          background: `${ROLE_COLORS[inv.role]}18`,
                          color: ROLE_COLORS[inv.role] || '#6b7280',
                        }}>
                          {ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
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
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowInviteModal(false) }}
        >
          <div style={{
            background: '#13151f', border: '1px solid #1e2130',
            borderRadius: 16, padding: '32px', width: 440,
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f0f2fa' }}>
              Invite User
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
              Send an invite link. They&apos;ll get their role automatically when they sign in with Google.
            </p>

            {inviteLink ? (
              <>
                <div style={{
                  background: '#0d1117', border: '1px solid #1e2130',
                  borderRadius: 8, padding: '12px 16px', marginBottom: 20,
                  fontSize: 12, color: '#6b7280', wordBreak: 'break-all', lineHeight: 1.6,
                }}>
                  <div style={{ color: '#34d399', marginBottom: 8, fontWeight: 600 }}>
                    ✓ Invite created — share this link:
                  </div>
                  {inviteLink}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteLink) }}
                  style={{
                    width: '100%', padding: '10px',
                    background: '#1e2130', color: '#f0f2fa',
                    border: '1px solid #2a2d3e', borderRadius: 8,
                    fontSize: 14, cursor: 'pointer', marginBottom: 10,
                  }}
                >
                  Copy Link
                </button>
                <button
                  onClick={() => { setShowInviteModal(false); setInviteEmail(''); setInviteLink('') }}
                  style={{
                    width: '100%', padding: '10px',
                    background: 'transparent', color: '#6b7280',
                    border: 'none', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="name@company.com"
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: '#0d1117', color: '#f0f2fa',
                      border: '1px solid #2a2d3e', borderRadius: 8,
                      fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'manager' | 'employee')}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: '#0d1117', color: '#f0f2fa',
                      border: '1px solid #2a2d3e', borderRadius: 8,
                      fontSize: 14,
                    }}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    style={{
                      flex: 1, padding: '10px',
                      background: 'transparent', color: '#6b7280',
                      border: '1px solid #2a2d3e', borderRadius: 8,
                      fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendInvite}
                    disabled={!inviteEmail || inviteLoading}
                    style={{
                      flex: 2, padding: '10px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      opacity: !inviteEmail || inviteLoading ? 0.5 : 1,
                    }}
                  >
                    {inviteLoading ? 'Creating...' : 'Create Invite Link'}
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
