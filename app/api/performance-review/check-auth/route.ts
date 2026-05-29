import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const vars = {
    GOOGLE_CLIENT_ID:          !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET:      !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI:       !!process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_DRIVE_REFRESH_TOKEN: !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  }

  // Try to get an access token
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )
    auth.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN })
    const tokenRes = await auth.getAccessToken()
    return NextResponse.json({ ok: true, vars, token: !!tokenRes.token })
  } catch (err: unknown) {
    const error = err as { message?: string; response?: { data?: unknown } }
    return NextResponse.json({
      ok: false,
      vars,
      error: error?.message,
      details: error?.response?.data,
    })
  }
}
