// Google OAuth credentials arrive as environment variables, which are routinely
// pasted into hosting dashboards by hand. Line wrapping there can inject a space
// or newline into the middle of a value, and `.trim()` only strips the ends — an
// interior space survives and Google rejects the request with `invalid_client`,
// which reads like a deleted or misconfigured OAuth client rather than a typo.
//
// None of these values legitimately contain whitespace (client IDs and secrets
// are alphanumeric with dashes; refresh tokens are URL-safe base64), so strip
// every whitespace character rather than only the outer ones.
function scrub(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, '')
}

export const googleClientId     = () => scrub(process.env.GOOGLE_CLIENT_ID)
export const googleClientSecret = () => scrub(process.env.GOOGLE_CLIENT_SECRET)
export const googleRefreshToken = () => scrub(process.env.GOOGLE_DRIVE_REFRESH_TOKEN)
