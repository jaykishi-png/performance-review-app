'use client'

/**
 * Calibr UI primitives.
 *
 * §39 asks for shared components rather than pages styling themselves. This is
 * the first tranche: the pieces the existing portals repeat most often, built
 * only from design tokens so they follow light and dark with no per-theme code.
 *
 * These are additive — existing screens keep working untouched, and each one is
 * migrated onto these primitives rather than being restyled in place.
 */

import type { CSSProperties, ReactNode } from 'react'

/* ── Typography (§11) ─────────────────────────────────────────────────────── */

type TextTone = 'default' | 'secondary' | 'muted' | 'faint' | 'brand'

const TONE: Record<TextTone, string> = {
  default: 'var(--text)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  faint: 'var(--text-faint)',
  brand: 'var(--brand-text)',
}

export function PageHeading({ children, tone = 'default', style }: {
  children: ReactNode; tone?: TextTone; style?: CSSProperties
}) {
  return (
    <h1 style={{ font: 'var(--font-page)', letterSpacing: 'var(--tracking-page)', color: TONE[tone], margin: 0, ...style }}>
      {children}
    </h1>
  )
}

export function SectionHeading({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h2 style={{ font: 'var(--font-section)', color: 'var(--text)', margin: 0, ...style }}>{children}</h2>
  )
}

export function CardHeading({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h3 style={{ font: 'var(--font-card)', color: 'var(--text)', margin: 0, ...style }}>{children}</h3>
  )
}

export function Body({ children, tone = 'default', style }: {
  children: ReactNode; tone?: TextTone; style?: CSSProperties
}) {
  return <p style={{ font: 'var(--font-body)', color: TONE[tone], margin: 0, ...style }}>{children}</p>
}

/** Uppercase field/section label. */
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      font: 'var(--font-meta)', fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em', ...style,
    }}>
      {children}
    </div>
  )
}

export function Meta({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ font: 'var(--font-meta)', color: 'var(--text-muted)', ...style }}>{children}</span>
}

/* ── Card (§18) — restrained: 10px radius, 1px border, barely-there shadow ── */

export function Card({ children, padding = 'var(--space-6)', style }: {
  children: ReactNode; padding?: string | number; style?: CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding,
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Button (§19) ─────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md'

function buttonStyle(variant: ButtonVariant, size: ButtonSize, disabled: boolean): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
    padding: size === 'sm' ? '6px 12px' : '9px 16px',
    font: size === 'sm' ? 'var(--font-label)' : 'var(--font-body)',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: `background var(--motion-fast) var(--motion-ease), border-color var(--motion-fast) var(--motion-ease)`,
    whiteSpace: 'nowrap',
  }
  switch (variant) {
    case 'primary':
      return { ...base, background: 'var(--brand-strong)', color: '#ffffff', border: '1px solid transparent' }
    case 'secondary':
      return { ...base, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)' }
    case 'ghost':
      return { ...base, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' }
    case 'destructive':
      return { ...base, background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }
  }
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled = false, type = 'button', title, style,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  type?: 'button' | 'submit'
  title?: string
  style?: CSSProperties
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{ ...buttonStyle(variant, size, disabled), ...style }}
      onMouseOver={e => {
        if (disabled) return
        if (variant === 'primary') e.currentTarget.style.background = 'var(--brand-deep)'
        else if (variant === 'secondary' || variant === 'ghost') e.currentTarget.style.background = 'var(--surface-hover)'
      }}
      onMouseOut={e => {
        if (disabled) return
        const s = buttonStyle(variant, size, disabled)
        e.currentTarget.style.background = String(s.background)
      }}
    >
      {children}
    </button>
  )
}

/* ── Badges (§39) ─────────────────────────────────────────────────────────── */

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

const STATUS: Record<StatusTone, { fg: string; bg: string; bd: string }> = {
  success: { fg: 'var(--success-text)', bg: 'var(--success-bg)', bd: 'var(--success-border)' },
  warning: { fg: 'var(--warning-text)', bg: 'var(--warning-bg)', bd: 'var(--warning-border)' },
  danger: { fg: 'var(--danger-text)', bg: 'var(--danger-bg)', bd: 'var(--danger-border)' },
  info: { fg: 'var(--info)', bg: 'var(--info-bg)', bd: 'var(--info-border)' },
  neutral: { fg: 'var(--text-muted)', bg: 'var(--surface-sunken)', bd: 'var(--border)' },
  brand: { fg: 'var(--brand-text)', bg: 'var(--brand-tint)', bd: 'var(--brand-soft)' },
}

export function StatusBadge({ children, tone = 'neutral', style }: {
  children: ReactNode; tone?: StatusTone; style?: CSSProperties
}) {
  const c = STATUS[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 'var(--radius-pill)',
      font: 'var(--font-meta)', fontWeight: 600,
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
      whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </span>
  )
}

/* ── Rating badge (§10) ───────────────────────────────────────────────────────
 * Performance ratings are shown as a label with a colour, never colour alone,
 * and never as an alarm: a lower rating gets a calm chip, not a red card. */

export type Rating =
  | 'exceptional' | 'exceeds' | 'meets' | 'developing' | 'needs-improvement'

const RATING_LABEL: Record<Rating, string> = {
  exceptional: 'Exceptional',
  exceeds: 'Exceeds',
  meets: 'Meets',
  developing: 'Developing',
  'needs-improvement': 'Needs Improvement',
}

export function RatingBadge({ rating, style }: { rating: Rating; style?: CSSProperties }) {
  const colour = `var(--rating-${rating})`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 'var(--radius-pill)',
      font: 'var(--font-meta)', fontWeight: 600,
      color: 'var(--text)', background: 'var(--surface-sunken)',
      border: '1px solid var(--border)', whiteSpace: 'nowrap', ...style,
    }}>
      <span aria-hidden="true" style={{
        width: 7, height: 7, borderRadius: '50%', background: colour, flexShrink: 0,
      }} />
      {RATING_LABEL[rating]}
    </span>
  )
}

/* ── Progress (§33) — borrows the logo's segmentation ─────────────────────── */

export function ProgressBar({ value, max = 100, tone = 'brand', label }: {
  value: number; max?: number; tone?: 'brand' | StatusTone; label?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const fill = tone === 'brand' ? 'var(--brand)' : `var(--${tone})`
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <Meta>{label}</Meta>
          <Meta style={{ fontWeight: 600, color: 'var(--text)' }}>{Math.round(pct)}%</Meta>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        style={{
          height: 6, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          width: `${pct}%`, height: '100%', background: fill,
          borderRadius: 'var(--radius-pill)',
          transition: `width var(--motion-slow) var(--motion-ease)`,
        }} />
      </div>
    </div>
  )
}

/** Segmented ring — the logo motif as a progress indicator (§33). */
export function ProgressRing({ value, max = 100, size = 44, segments = 4 }: {
  value: number; max?: number; size?: number; segments?: number
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const r = 16
  const c = 2 * Math.PI * r
  const gap = 6
  const seg = c / segments - gap
  const done = pct * c

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img"
      aria-label={`${Math.round(pct * 100)}% complete`} style={{ display: 'block' }}>
      <g transform="rotate(-90 20 20)">
        {Array.from({ length: segments }).map((_, i) => {
          const start = i * (c / segments)
          const filled = Math.max(0, Math.min(seg, done - start))
          return (
            <g key={i}>
              <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={`${seg} ${c - seg}`} strokeDashoffset={-start} />
              {filled > 0 && (
                <circle cx="20" cy="20" r={r} fill="none" stroke="var(--brand)" strokeWidth="4"
                  strokeLinecap="round" strokeDasharray={`${filled} ${c - filled}`} strokeDashoffset={-start} />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/* ── Empty state (§32) — contextual, never "No data found." ───────────────── */

export function EmptyState({ title, description, action }: {
  title: string; description: string; action?: ReactNode
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: 'var(--space-12) var(--space-6)', gap: 'var(--space-3)',
    }}>
      <CardHeading>{title}</CardHeading>
      <Body tone="muted" style={{ maxWidth: 420, lineHeight: 1.6 }}>{description}</Body>
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)',
      padding: 'var(--space-10)',
    }}>
      <span aria-hidden="true" style={{
        width: 16, height: 16, borderRadius: '50%',
        border: '2px solid var(--border)', borderTopColor: 'var(--brand)',
        animation: 'spin 0.8s linear infinite', display: 'block',
      }} />
      <Meta>{label}</Meta>
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', description, action }: {
  title?: string; description: string; action?: ReactNode
}) {
  return (
    <div style={{
      background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)',
    }}>
      <div style={{ font: 'var(--font-card)', color: 'var(--danger-text)', marginBottom: 4 }}>{title}</div>
      <Body style={{ color: 'var(--danger-text)' }}>{description}</Body>
      {action && <div style={{ marginTop: 'var(--space-3)' }}>{action}</div>}
    </div>
  )
}
