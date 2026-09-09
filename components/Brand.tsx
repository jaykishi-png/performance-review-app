'use client'

/* eslint-disable @next/next/no-img-element */

import { useTheme } from '@/lib/theme'

/**
 * Calibr brand marks.
 *
 * These render the supplied asset files. The logo is not redrawn, recoloured or
 * recomposed here — the package ships separate light and dark files and its
 * README forbids recolouring or altering the icon-to-wordmark spacing, so both
 * variants are rendered and CSS shows the right one (.calibr-on-light /
 * .calibr-on-dark in globals.css). Choosing in CSS rather than from the theme
 * hook means the correct mark is painted on the first frame, with no flash of
 * the wrong variant before hydration.
 *
 * Format differs by asset, deliberately:
 *
 *   icon   → SVG. No text, so it stays crisp at any size.
 *   lockup → PNG. The SVG sets the wordmark in Inter ExtraBold, and an SVG
 *            loaded through <img> cannot reach the page's webfonts, so the
 *            wordmark would quietly fall back to Arial — lighter and wider than
 *            designed. The supplied PNG is 2048px wide, far beyond any
 *            placement here, so nothing is lost by using it.
 */

const ICON_LIGHT = '/brand/calibr-icon-light.svg'
const ICON_DARK = '/brand/calibr-icon-dark.svg'
const LOCKUP_LIGHT = '/brand/calibr-horizontal-light.png'
const LOCKUP_DARK = '/brand/calibr-horizontal-dark.png'

/** Calibration-ring symbol on its own. */
export function CalibrIcon({ size = 32 }: { size?: number }) {
  // `display` is deliberately absent: the .calibr-on-* classes own it, and an
  // inline value would outrank them and show both variants at once.
  const common = { width: size, height: size, alt: 'Calibr', style: { flexShrink: 0 } }
  return (
    <>
      <img {...common} className="calibr-on-light" src={ICON_LIGHT} />
      <img {...common} className="calibr-on-dark" src={ICON_DARK} />
    </>
  )
}

/**
 * Primary horizontal lockup. The artwork is 600×160, so height drives the size
 * and width follows the artwork's own ratio — the spacing between icon and
 * wordmark is the designed one and is never adjusted here.
 */
export function CalibrLogo({ height = 30 }: { height?: number }) {
  const width = Math.round(height * (600 / 160))
  // `display` is owned by the .calibr-on-* classes — see CalibrIcon.
  const common = { width, height, alt: 'Calibr', style: { flexShrink: 0 } }
  return (
    <>
      <img {...common} className="calibr-on-light" src={LOCKUP_LIGHT} />
      <img {...common} className="calibr-on-dark" src={LOCKUP_DARK} />
    </>
  )
}

/** The tagline, for the login screen and other brand moments. */
export function CalibrTagline({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--brand-text)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      Align People. Unlock Potential.
    </span>
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
