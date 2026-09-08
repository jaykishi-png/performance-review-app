'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ConsentData {
  id: string
  token: string
  token_role: 'manager' | 'employee'
  manager_name: string
  employee_name: string
  meeting_date: string
  year?: number
  quarter?: string
  manager_consented: boolean
  employee_consented: boolean
  declined: boolean
  status: 'pending' | 'consented' | 'declined'
}

type PageState =
  | 'loading'
  | 'not_found'
  | 'already_consented'
  | 'declined'
  | 'form'

export default function ConsentPage() {
  const params = useParams()
  const token = params?.token as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [data, setData] = useState<ConsentData | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionResult, setActionResult] = useState<null | {
    type: 'consented' | 'declined'
    both_consented?: boolean
  }>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    fetch(`/api/recordings/consent?token=${token}`)
      .then((res) => {
        if (res.status === 404) {
          setPageState('not_found')
          return null
        }
        return res.json()
      })
      .then((json) => {
        if (!json) return

        setData(json)

        if (json.declined) {
          setPageState('declined')
        } else if (
          (json.token_role === 'manager' && json.manager_consented) ||
          (json.token_role === 'employee' && json.employee_consented)
        ) {
          setPageState('already_consented')
        } else {
          setPageState('form')
        }
      })
      .catch(() => {
        setPageState('not_found')
      })
  }, [token])

  const handleAction = async (action: 'consent' | 'decline') => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recordings/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err?.error || 'Something went wrong. Please try again.')
        setActionLoading(false)
        return
      }

      const json = await res.json()

      if (action === 'consent') {
        setActionResult({
          type: 'consented',
          both_consented: json.both_consented ?? false,
        })
      } else {
        setActionResult({ type: 'declined' })
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div style={styles.card}>
        <div style={styles.centered}>
          <div style={styles.spinner} />
          <p style={styles.mutedText}>Loading consent request...</p>
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (pageState === 'not_found') {
    return (
      <div style={styles.card}>
        <div style={styles.centered}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <h2 style={styles.heading}>Link Not Found</h2>
          <p style={styles.mutedText}>
            This consent link is invalid or has expired.
          </p>
        </div>
      </div>
    )
  }

  // ── Already consented ────────────────────────────────────────────────────
  if (pageState === 'already_consented') {
    return (
      <div style={styles.card}>
        <div style={styles.centered}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h2 style={styles.heading}>Consent Already Recorded</h2>
          <p style={styles.mutedText}>
            You have already given consent for this recording. Thank you.
          </p>
        </div>
      </div>
    )
  }

  // ── Declined ─────────────────────────────────────────────────────────────
  if (pageState === 'declined') {
    return (
      <div style={styles.card}>
        <div style={styles.centered}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
          <h2 style={styles.heading}>Recording Declined</h2>
          <p style={styles.mutedText}>
            This recording request has been declined.
          </p>
        </div>
      </div>
    )
  }

  // ── Post-action success states ────────────────────────────────────────────
  if (actionResult) {
    const portalUrl = data?.token_role === 'manager' ? '/manager' : '/employee'
    const portalLabel = data?.token_role === 'manager' ? 'Go to Manager Portal' : 'Go to Employee Portal'

    if (actionResult.type === 'consented') {
      return (
        <div style={styles.card}>
          <div style={styles.centered}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎙️</div>
            <h2 style={styles.heading}>Consent Recorded</h2>
            <p style={styles.mutedText}>
              Thank you! Your consent has been recorded.
            </p>
            {actionResult.both_consented && (
              <div style={styles.successBox}>
                Both parties have consented. Recording is now enabled.
              </div>
            )}
            <a
              href={portalUrl}
              style={{ marginTop: 20, display: 'inline-block', padding: '12px 28px', background: 'linear-gradient(135deg,var(--brand-strong),var(--brand-strong))', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
            >
              {portalLabel} →
            </a>
          </div>
        </div>
      )
    }

    if (actionResult.type === 'declined') {
      return (
        <div style={styles.card}>
          <div style={styles.centered}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
            <h2 style={styles.heading}>Recording Declined</h2>
            <p style={styles.mutedText}>
              You have declined the recording request. Your manager has been
              notified.
            </p>
            <a
              href={portalUrl}
              style={{ marginTop: 20, display: 'inline-block', padding: '12px 28px', background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
            >
              {portalLabel} →
            </a>
          </div>
        </div>
      )
    }
  }

  // ── Main consent form ─────────────────────────────────────────────────────
  if (!data) return null

  const iHaveConsented =
    (data.token_role === 'manager' && data.manager_consented) ||
    (data.token_role === 'employee' && data.employee_consented)

  const iHaveDecided = iHaveConsented || data.declined

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.icon}>🎙️</span>
        <h1 style={styles.title}>1:1 Meeting Recording Request</h1>
      </div>

      {/* Meeting info */}
      <div style={styles.meetingInfo}>
        <div style={styles.names}>
          {data.manager_name} × {data.employee_name}
        </div>
        <div style={styles.meetingDate}>{formatDate(data.meeting_date)}</div>
        {(data.year || data.quarter) && (
          <div style={styles.quarterBadge}>
            {[data.year, data.quarter].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Warning info box */}
      <div style={styles.amberBox}>
        <span style={styles.amberIcon}>⚠️</span>
        <p style={styles.amberText}>
          Recording will only begin once both parties have consented. Either
          party can decline at any time. Recordings are used solely for
          generating meeting notes and are stored securely.
        </p>
      </div>

      {/* Role context */}
      <p style={styles.roleText}>
        {data.token_role === 'manager'
          ? 'You are confirming consent as the meeting organizer.'
          : 'Your manager has requested to record this 1:1 meeting.'}
      </p>

      {/* Consent status */}
      <div style={styles.statusBox}>
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>Manager</span>
          <span style={data.manager_consented ? styles.statusGreen : styles.statusPending}>
            {data.manager_consented ? '✓ Consented' : '⏳ Pending'}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>Employee</span>
          <span style={data.employee_consented ? styles.statusGreen : styles.statusPending}>
            {data.employee_consented ? '✓ Consented' : '⏳ Pending'}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Action buttons */}
      {!iHaveDecided && (
        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.consentButton,
              opacity: actionLoading ? 0.6 : 1,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
            disabled={actionLoading}
            onClick={() => handleAction('consent')}
          >
            {actionLoading ? 'Processing...' : '✓ I Consent to Being Recorded'}
          </button>
          <button
            style={{
              ...styles.declineButton,
              opacity: actionLoading ? 0.6 : 1,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
            disabled={actionLoading}
            onClick={() => handleAction('decline')}
          >
            ✗ Decline Recording
          </button>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--surface-raised)',
    borderRadius: 16,
    padding: '32px 28px',
    color: 'var(--text)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '16px 0',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--surface-raised)',
    borderTop: '3px solid var(--brand)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text-strong)',
    margin: '0 0 8px',
  },
  mutedText: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  icon: {
    fontSize: 28,
    lineHeight: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-strong)',
    margin: 0,
  },
  meetingInfo: {
    marginBottom: 20,
  },
  names: {
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--brand-text)',
    marginBottom: 6,
  },
  meetingDate: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  quarterBadge: {
    display: 'inline-block',
    fontSize: 12,
    color: 'var(--brand)',
    backgroundColor: 'var(--brand-tint)',
    border: '1px solid var(--brand-strong)',
    borderRadius: 6,
    padding: '2px 10px',
  },
  amberBox: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'var(--warning-bg)',
    border: '1px solid var(--warning-text)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 20,
  },
  amberIcon: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 1,
  },
  amberText: {
    fontSize: 13,
    color: 'var(--warning)',
    margin: 0,
    lineHeight: 1.6,
  },
  roleText: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 20,
    padding: '10px 14px',
    backgroundColor: 'var(--surface-inset)',
    borderRadius: 8,
    border: '1px solid var(--surface-raised)',
  },
  statusBox: {
    backgroundColor: 'var(--surface-inset)',
    border: '1px solid var(--surface-raised)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
  },
  statusLabel: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  statusGreen: {
    fontSize: 13,
    color: 'var(--success)',
    fontWeight: 600,
  },
  statusPending: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--surface-raised)',
    margin: '0 16px',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  consentButton: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, var(--success) 0%, var(--success) 100%)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  declineButton: {
    width: '100%',
    padding: '12px',
    borderRadius: 10,
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--surface-inset)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  successBox: {
    marginTop: 16,
    padding: '12px 16px',
    backgroundColor: 'var(--success-bg)',
    border: '1px solid var(--success-text)',
    borderRadius: 10,
    color: 'var(--success)',
    fontSize: 14,
    textAlign: 'center' as const,
  },
  errorBox: {
    marginBottom: 16,
    padding: '12px 16px',
    backgroundColor: 'var(--danger-bg)',
    border: '1px solid var(--danger-border)',
    borderRadius: 10,
    color: 'var(--danger)',
    fontSize: 13,
  },
}
