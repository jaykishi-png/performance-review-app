/**
 * Run with:  node get-refresh-token.mjs
 *
 * Opens a browser, you sign in with Google, and the refresh token
 * is printed in the terminal. Copy it into Vercel as GOOGLE_DRIVE_REFRESH_TOKEN.
 */

import { createServer } from 'http'
import { exec }         from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// ── Load env vars from .env.local ─────────────────────────────────────────────
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env.local')
let envText = ''
try { envText = readFileSync(envPath, 'utf8') } catch { /* ignore */ }

const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const CLIENT_ID     = env.GOOGLE_CLIENT_ID     || process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI  = 'http://localhost:3333/oauth2callback'
const SCOPE         = 'https://www.googleapis.com/auth/drive'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in .env.local')
  process.exit(1)
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log('\n🔐  Opening browser to authorize Google Drive access…')
console.log('    If the browser does not open, paste this URL manually:\n')
console.log('   ', authUrl, '\n')

// Open browser
const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
exec(`${opener} "${authUrl}"`)

// Spin up a one-shot local server to catch the OAuth callback
const server = createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:3333`)
  const code = url.searchParams.get('code')

  if (!code) {
    res.writeHead(400); res.end('No code found'); return
  }

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<h2 style="font-family:sans-serif;padding:2rem">✅ Authorized! Check your terminal for the refresh token.</h2>')
  server.close()

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.refresh_token) {
    console.log('✅  SUCCESS! Your new refresh token:\n')
    console.log('   ', tokens.refresh_token)
    console.log('\n👉  Copy this value and update GOOGLE_DRIVE_REFRESH_TOKEN in Vercel.')
  } else {
    console.error('❌  No refresh token in response:', JSON.stringify(tokens, null, 2))
  }
})

server.listen(3333, () => {
  console.log('⏳  Waiting for Google to redirect back to localhost:3333…\n')
})
