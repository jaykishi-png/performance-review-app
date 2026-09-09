'use client'

import { useTheme } from '@/lib/theme'

/**
 * Calibr brand marks and the theme control.
 *
 * The logo is drawn as an inline SVG rather than shipped as an image file so it
 * inherits the theme: the ring and wordmark read from CSS variables, which is
 * what the brand guidelines call for with their light and dark variants.
 *
 * The ring is four arcs with gaps — the "calibration" motif — around a check.
 */

export function CalibrIcon({ size = 32 }: { size?: number }) {
  // Four arcs of a 44-radius circle, each leaving a gap, drawn light-to-dark
  // clockwise from the top as in the guidelines.
  const arcs = [
    { d: 'M 50 6 A 44 44 0 0 1 94 50', color: 'var(--brand)' },
    { d: 'M 94 50 A 44 44 0 0 1 68 90', color: 'var(--brand-strong)' },
    { d: 'M 62 94 A 44 44 0 0 1 16 71', color: 'var(--brand-strong)' },
    { d: 'M 9 62 A 44 44 0 0 1 50 6', color: 'var(--brand)' },
  ]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      data-icon-raw
      role="img"
      aria-label="Calibr"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {arcs.map((a, i) => (
        <path key={i} d={a.d} stroke={a.color} strokeWidth={11} strokeLinecap="round" />
      ))}
      <path
        d="M 31 51 L 44 64 L 70 37"
        stroke="var(--text-strong)"
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CalibrLogo({
  size = 28,
  showTagline = false,
  stacked = false,
}: {
  size?: number
  showTagline?: boolean
  stacked?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: 'center',
        gap: stacked ? 8 : 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CalibrIcon size={size} />
        <span
          style={{
            fontSize: size * 0.86,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-strong)',
            lineHeight: 1,
          }}
        >
          Calibr
        </span>
      </div>
      {showTagline && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          Align People. Unlock Potential.
        </span>
      )}
    </div>
  )
}

/** Sun / moon toggle. Sits in each portal's header. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: compact ? 32 : undefined,
        height: 32,
        padding: compact ? 0 : '0 10px',
        background: 'var(--surface-hover)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {theme === 'dark' ? (
        // Moon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sun
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      {!compact && <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>}
    </button>
  )
}
