import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const maxDuration = 30

const SA_TEMPLATE_DOC_ID = '14CTluQZ2yyLDrNLvx8fjtPycIZ9JFhxH_ukQzgsZqLE'

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     (process.env.GOOGLE_CLIENT_ID     ?? '').trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
      refresh_token: (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? '').trim(),
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) throw new Error(`Token error: ${data.error}`)
  return data.access_token
}

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken()
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token })
    const docs = google.docs({ version: 'v1', auth })

    const docData = await docs.documents.get({ documentId: SA_TEMPLATE_DOC_ID })
    const content = docData.data.body?.content ?? []

    // Collect every paragraph element with its type and raw shape
    const elements: object[] = []

    function walk(els: typeof content) {
      for (const el of els) {
        if (el.paragraph?.elements) {
          for (const pe of el.paragraph.elements) {
            const type = pe.textRun ? 'textRun'
              : pe.richLink ? 'richLink'
              : pe.person ? 'person'
              : pe.inlineObjectElement ? 'inlineObjectElement'
              : pe.equation ? 'equation'
              : 'other'

            elements.push({
              type,
              startIndex: pe.startIndex,
              endIndex: pe.endIndex,
              // Show the raw element minus massive nested objects
              textContent: pe.textRun?.content ?? null,
              richLinkTitle: (pe.richLink as { richLinkProperties?: { title?: string; uri?: string } } | undefined)?.richLinkProperties?.title ?? null,
              richLinkUri: (pe.richLink as { richLinkProperties?: { title?: string; uri?: string } } | undefined)?.richLinkProperties?.uri ?? null,
              personName: (pe.person as { personProperties?: { name?: string } } | undefined)?.personProperties?.name ?? null,
              // Full raw dump of unknown types
              raw: type === 'other' ? pe : undefined,
            })
          }
        } else if (el.table?.tableRows) {
          for (const row of el.table.tableRows ?? []) {
            for (const cell of row.tableCells ?? []) {
              walk(cell.content ?? [])
            }
          }
        }
      }
    }

    walk(content)

    // Filter to just the interesting ones: non-plain-text or text near SELECT ONE
    const interesting = elements.filter((e: object) => {
      const el = e as { type: string; textContent?: string | null }
      if (el.type !== 'textRun') return true
      if (el.textContent?.includes('SELECT') || el.textContent?.includes('select')) return true
      return false
    })

    return NextResponse.json({ total: elements.length, interesting, all: elements })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
