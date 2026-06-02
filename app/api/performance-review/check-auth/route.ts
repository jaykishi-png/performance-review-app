import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const vars = {
    GOOGLE_CLIENT_ID:          !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET:      !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI:       !!process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_DRIVE_REFRESH_TOKEN: !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  }

  const clientId     = (process.env.GOOGLE_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  const refreshToken = (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? '').trim()

  // Attempt manual token refresh
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    })
    const data = await res.json()
    return NextResponse.json({
      ok: res.ok && !!data.access_token,
      vars,
      credentialPrefixes: {
        clientId:     clientId.slice(0, 25),
        clientSecret: clientSecret.slice(0, 8),
        refreshToken: refreshToken.slice(0, 12),
      },
      googleResponse: data,
    })
  } catch (err: unknown) {
    const error = err as { message?: string }
    return NextResponse.json({ ok: false, vars, error: error?.message })
  }
}
