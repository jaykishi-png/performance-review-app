import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 10

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ ok: false, reason: 'no id' })

  try {
    // Get a fresh access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     (process.env.GOOGLE_CLIENT_ID     ?? '').trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
        refresh_token: (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? '').trim(),
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
