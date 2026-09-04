/**
 * Base URL for links the app emails out.
 *
 * Every outgoing email — feedback requests, invites, cron reminders, signing
 * links — is only useful if its host actually serves the current build. Hardcoding
 * a *.vercel.app domain here does not guarantee that: an auto-generated domain
 * can stop tracking production (pinned to an old deployment, or reassigned to
 * another project) and then every emailed link silently points at stale code.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL      — an explicit choice always wins, so a custom
 *                                 domain can be set without touching code.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the project's own production domain,
 *                                 supplied by Vercel. Tracks production by
 *                                 definition, so it cannot drift.
 *   3. VERCEL_URL               — this specific deployment (preview builds).
 *   4. http://localhost:3000    — local development.
 */

function normalize(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function getAppUrl(): string {
  return (
    normalize(process.env.NEXT_PUBLIC_APP_URL ?? '') ||
    normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '') ||
    normalize(process.env.VERCEL_URL ?? '') ||
    'http://localhost:3000'
  )
}
