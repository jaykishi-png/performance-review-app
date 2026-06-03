import { NextRequest, NextResponse } from 'next/server'
import { google, docs_v1 } from 'googleapis'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

// Self-assessment files land in the same Performance Reviews folder by default
// The manager can also pass a custom folder ID in the request body
const SELF_ASSESSMENT_FOLDER = '1vj8HSp0QnBlfwCoLvtzz-z3uJkh_84hg'

// ── Auth (same pattern as manager review) ─────────────────────────────────────
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
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token error: ${data.error} — ${data.error_description}`)
  }
  return data.access_token
}

function getAuth(token: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })
  return auth
}

// ── Document builder types ─────────────────────────────────────────────────────
interface Block {
  text: string
  heading?: 'HEADING_1' | 'HEADING_2' | 'HEADING_3'
  bold?: boolean
  italic?: boolean
  fontSize?: number
  color?: { red: number; green: number; blue: number }
  spaceAfter?: number
  indent?: number
}

const STAR_LABELS: Record<number, { label: string; description: string }> = {
  5: { label: 'Outstanding',           description: 'Consistently exceeds performance requirements.' },
  4: { label: 'Exceeds Job Requirements', description: 'Meets and at times exceeds performance requirements (above average).' },
  3: { label: 'Meets Expectations',    description: 'Job requirements are being met at a satisfactory level.' },
  2: { label: 'Needs Improvement',     description: 'Does not consistently meet the expected job requirements.' },
  1: { label: 'Unsatisfactory',        description: 'Demonstrates an unacceptable level of skills and competencies.' },
}

const ORDINALS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE']
const TYPE_LABELS: Record<string, string> = {
  positive: 'Positive',
  constructive: 'Constructive',
  choice: 'Your Choice',
}

const RUSH_PURPLE = { red: 0.31, green: 0.18, blue: 0.56 }
const DARK_GRAY   = { red: 0.2,  green: 0.2,  blue: 0.2  }
const MID_GRAY    = { red: 0.45, green: 0.45, blue: 0.45 }

// ── Build document blocks from self-assessment data ────────────────────────────
interface SelfAssessmentData {
  employeeName: string
  employeePosition: string
  supervisorName: string
  appraisalPeriod: string
  dateCompleted: string
  competencies: Array<{ type: string; term: string; definition: string; examples: string[] }>
  goalsObjectives: Array<{ description: string; outcome: string; reasoning: string }>
  overallRating: number | null
  nextYearGoals: Array<{ goal: string; objective: string }>
}

function buildBlocks(d: SelfAssessmentData): Block[] {
  const blocks: Block[] = []

  // ── Cover / header ──────────────────────────────────────────────────────────
  blocks.push({ text: 'Rush Media', bold: true, fontSize: 11, color: MID_GRAY, italic: true })
  blocks.push({ text: 'Employee Self-Assessment', heading: 'HEADING_1', color: RUSH_PURPLE, fontSize: 22 })
  blocks.push({ text: '' })

  // Info table as plain text block pairs
  const info = [
    ['Employee Name',  d.employeeName],
    ['Position',       d.employeePosition],
    ['Supervisor',     d.supervisorName],
    ['Appraisal Period', d.appraisalPeriod],
    ['Date Completed', d.dateCompleted],
  ]
  for (const [label, value] of info) {
    blocks.push({ text: `${label}:  ${value || '—'}`, bold: false, fontSize: 11 })
  }
  blocks.push({ text: '' })
  blocks.push({ text: '──────────────────────────────────────────────────────────────', color: MID_GRAY, fontSize: 9 })
  blocks.push({ text: '' })

  // Policy disclaimer
  blocks.push({
    text: 'All employees will have an annual performance review on or around the date of their work anniversary. Merit increases are determined by several factors including financial health, Company profitability, job performance, and consumer price index. A positive performance review does not guarantee a pay raise or continued employment.',
    fontSize: 9, color: MID_GRAY, italic: true,
  })
  blocks.push({ text: '' })

  // ── Part One ────────────────────────────────────────────────────────────────
  blocks.push({ text: 'PART ONE — COMPETENCY EVALUATION', heading: 'HEADING_2', color: RUSH_PURPLE })
  blocks.push({
    text: 'Consider what is working about your performance and where improvements can be made. Five competency words have been evaluated below, with specific examples for each. Please review the Competency Glossary of Terms for definitions.',
    fontSize: 10, color: MID_GRAY, italic: true,
  })
  blocks.push({ text: '' })

  d.competencies.forEach((comp, i) => {
    if (!comp.term) return
    const typeLabel = TYPE_LABELS[comp.type] || comp.type
    blocks.push({
      text: `COMPETENCY ${ORDINALS[i]}  ·  ${typeLabel.toUpperCase()}:  ${comp.term}`,
      heading: 'HEADING_3', color: DARK_GRAY,
    })
    if (comp.definition) {
      blocks.push({ text: comp.definition, fontSize: 10, color: MID_GRAY, italic: true, indent: 720 })
    }
    blocks.push({ text: '' })
    const filled = comp.examples.filter(e => e?.trim())
    if (filled.length > 0) {
      blocks.push({ text: 'Examples:', bold: true, fontSize: 10 })
      filled.forEach((ex, j) => {
        blocks.push({ text: `${j + 1}.  ${ex.trim()}`, fontSize: 10, indent: 360 })
      })
    }
    blocks.push({ text: '' })
  })

  // ── Part Two ────────────────────────────────────────────────────────────────
  blocks.push({ text: 'PART TWO — GOALS, OBJECTIVES & ACCOMPLISHMENTS', heading: 'HEADING_2', color: RUSH_PURPLE })
  blocks.push({
    text: 'Indicate your progress and the successful or unsuccessful completion of your goals or objectives, and explain why.',
    fontSize: 10, color: MID_GRAY, italic: true,
  })
  blocks.push({ text: '' })

  const filledGoals = d.goalsObjectives.filter(g => g.description?.trim())
  if (filledGoals.length > 0) {
    filledGoals.forEach((goal, i) => {
      blocks.push({ text: `${i + 1}.  ${goal.description.trim()}`, bold: true, fontSize: 11 })
      if (goal.outcome) {
        blocks.push({ text: `Outcome:  ${goal.outcome.charAt(0).toUpperCase() + goal.outcome.slice(1)}`, fontSize: 10, indent: 360 })
      }
      if (goal.reasoning?.trim()) {
        blocks.push({ text: `Reason:  ${goal.reasoning.trim()}`, fontSize: 10, indent: 360 })
      }
      blocks.push({ text: '' })
    })
  } else {
    blocks.push({ text: 'No goals or objectives recorded.', fontSize: 10, color: MID_GRAY, italic: true })
    blocks.push({ text: '' })
  }

  // Overall rating
  blocks.push({ text: 'OVERALL PERFORMANCE RATING', bold: true, fontSize: 11 })
  if (d.overallRating && STAR_LABELS[d.overallRating]) {
    const stars = '★'.repeat(d.overallRating) + '☆'.repeat(5 - d.overallRating)
    const rating = STAR_LABELS[d.overallRating]
    blocks.push({ text: `${stars}  ${d.overallRating} / 5  —  ${rating.label}`, bold: true, fontSize: 13, color: RUSH_PURPLE })
    blocks.push({ text: rating.description, fontSize: 10, color: MID_GRAY, italic: true })
  } else {
    blocks.push({ text: 'Not rated.', fontSize: 10, color: MID_GRAY })
  }
  blocks.push({ text: '' })

  // ── Part Three ──────────────────────────────────────────────────────────────
  blocks.push({ text: "PART THREE — NEXT YEAR'S GOALS & OBJECTIVES", heading: 'HEADING_2', color: RUSH_PURPLE })
  blocks.push({
    text: "Identify goals you anticipate or want to complete over the next review period, along with objectives on how you plan to reach them. These are subject to change based on your evaluation discussion with your manager.",
    fontSize: 10, color: MID_GRAY, italic: true,
  })
  blocks.push({ text: '' })

  const filledNextGoals = d.nextYearGoals.filter(g => g.goal?.trim())
  if (filledNextGoals.length > 0) {
    filledNextGoals.forEach((goal, i) => {
      blocks.push({ text: `${i + 1}.  Goal:  ${goal.goal.trim()}`, bold: true, fontSize: 11 })
      if (goal.objective?.trim()) {
        blocks.push({ text: `Objective / Roadmap:  ${goal.objective.trim()}`, fontSize: 10, indent: 360 })
      }
      blocks.push({ text: '' })
    })
  } else {
    blocks.push({ text: 'No next-year goals recorded.', fontSize: 10, color: MID_GRAY, italic: true })
    blocks.push({ text: '' })
  }

  // ── Signature block ─────────────────────────────────────────────────────────
  blocks.push({ text: '──────────────────────────────────────────────────────────────', color: MID_GRAY, fontSize: 9 })
  blocks.push({ text: '' })
  blocks.push({ text: `Employee Name:  ${d.employeeName}`, fontSize: 11 })
  blocks.push({ text: '' })
  blocks.push({ text: 'Employee Signature:  ___________________________________     Date Signed:  ________________', fontSize: 11 })

  return blocks
}

// ── Convert blocks → Google Docs batchUpdate requests ──────────────────────────
function blocksToRequests(blocks: Block[]): { fullText: string; requests: docs_v1.Schema$Request[] } {
  // Build full text string and track segment positions
  let fullText = ''
  const segments: Array<{ start: number; end: number; block: Block }> = []

  for (const block of blocks) {
    const start = fullText.length + 1 // +1 for doc start index offset
    fullText += block.text + '\n'
    const end = fullText.length + 1
    segments.push({ start, end, block })
  }

  const requests: docs_v1.Schema$Request[] = []

  // Insert all text at index 1
  requests.push({ insertText: { location: { index: 1 }, text: fullText } })

  // Apply paragraph and text styles in reverse order (highest index first)
  for (const { start, end, block } of [...segments].reverse()) {
    if (start >= end) continue

    // Paragraph style
    if (block.heading || block.spaceAfter || block.indent) {
      const named = block.heading as docs_v1.Schema$ParagraphStyle['namedStyleType']
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: {
            namedStyleType: named ?? 'NORMAL_TEXT',
            spaceAbove: block.heading === 'HEADING_1' ? { magnitude: 12, unit: 'PT' } : { magnitude: 4, unit: 'PT' },
            spaceBelow: { magnitude: block.spaceAfter ?? (block.heading ? 4 : 0), unit: 'PT' },
            indentStart: block.indent ? { magnitude: block.indent, unit: 'EMU' } : undefined,
          },
          fields: 'namedStyleType,spaceAbove,spaceBelow' + (block.indent ? ',indentStart' : ''),
        },
      })
    }

    // Text style
    const hasTextStyle = block.bold || block.italic || block.fontSize || block.color
    if (hasTextStyle) {
      const textStyle: docs_v1.Schema$TextStyle = {}
      if (block.bold !== undefined)   textStyle.bold = block.bold
      if (block.italic !== undefined) textStyle.italic = block.italic
      if (block.fontSize)             textStyle.fontSize = { magnitude: block.fontSize, unit: 'PT' }
      if (block.color)                textStyle.foregroundColor = { color: { rgbColor: block.color } }

      const fields = [
        block.bold !== undefined ? 'bold' : '',
        block.italic !== undefined ? 'italic' : '',
        block.fontSize ? 'fontSize' : '',
        block.color ? 'foregroundColor' : '',
      ].filter(Boolean).join(',')

      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 }, // -1 to exclude \n
          textStyle,
          fields,
        },
      })
    }
  }

  return { fullText, requests }
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as SelfAssessmentData & {
      selfReviewId?: string
      driveFolderId?: string
    }

    const targetFolder = body.driveFolderId?.trim() || SELF_ASSESSMENT_FOLDER

    const accessToken = await getAccessToken()
    const auth  = getAuth(accessToken)
    const drive = google.drive({ version: 'v3', auth })
    const docs  = google.docs({ version: 'v1', auth })

    // ── 1. Create new blank Google Doc ─────────────────────────────────────────
    const safeName   = (body.employeeName || 'Employee').replace(/[^a-zA-Z0-9]/g, '')
    const safePeriod = (body.appraisalPeriod || 'Period').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    const docTitle   = `${safeName}_SelfAssessment_${safePeriod}`

    const createRes = await drive.files.create({
      requestBody: {
        name: docTitle,
        mimeType: 'application/vnd.google-apps.document',
        parents: [targetFolder],
      },
      fields: 'id',
    })
    const docId = createRes.data.id
    if (!docId) throw new Error('Failed to create document — no ID returned.')

    // ── 2. Build and apply all content ─────────────────────────────────────────
    const blocks = buildBlocks(body)
    const { requests } = blocksToRequests(blocks)

    // Split into chunks of 50 requests to avoid API limits
    const CHUNK = 50
    for (let i = 0; i < requests.length; i += CHUNK) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests: requests.slice(i, i + CHUNK) },
      })
    }

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`

    // ── 3. Persist drive fields on the self_review row ─────────────────────────
    if (body.selfReviewId) {
      const serviceClient = await createServiceClient()
      await serviceClient
        .from('self_reviews')
        .update({ drive_doc_id: docId, drive_url: docUrl })
        .eq('id', body.selfReviewId)
        .eq('employee_id', user.id)
    }

    return NextResponse.json({ docId, docUrl, docTitle })
  } catch (err) {
    console.error('[self-review/send-to-drive]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
