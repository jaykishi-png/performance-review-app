import { NextRequest, NextResponse } from 'next/server'
import { googleClientId, googleClientSecret, googleRefreshToken } from '@/lib/google-credentials'
import { requireAdminActor, forbiddenResponse } from '@/lib/auth/authorize'

export const maxDuration = 10

export async function GET(req: NextRequest) {
  // Diagnostic endpoint: reports credential prefixes and raw Google API
  // responses, so it must not be reachable by non-admins.
  if (!await requireAdminActor()) return forbiddenResponse()
  const docId = req.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ ok: false, reason: 'no id' })

  try {
    // Get a fresh access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     googleClientId(),
        client_secret: googleClientSecret(),
        refresh_token: googleRefreshToken(),
        grant_type:    'refresh_token',
      }),
    })
    const tokenData = await tokenRes.json() as { access_token?: string }
    if (!tokenData.access_token) return NextResponse.json({ ok: false, reason: 'auth' })

    // Check if the file exists in Drive
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )
    if (!fileRes.ok) return NextResponse.json({ ok: false, reason: 'not_found' })
    const file = await fileRes.json() as { id?: string; trashed?: boolean }
    const alive = !!file.id && !file.trashed
    return NextResponse.json({ ok: alive, reason: alive ? 'exists' : 'trashed' })
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' })
  }
}
