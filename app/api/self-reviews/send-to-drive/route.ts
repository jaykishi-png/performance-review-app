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
  bold?: boolean
  italic?: boolean
  fontSize?: number
  color?: { red: number; green: number; blue: number }
  indent?: number       // indentStart in PT
  hangIndent?: number   // indentFirstLine negative offset (hanging indent) in PT
  center?: boolean
  spaceBefore?: number  // paddingTop in PT
  spaceAfter?: number   // paddingBottom in PT
  fontFamily?: string
}

const STAR_LABELS: Record<number, { label: string; description: string }> = {
  5: { label: 'Outstanding',              description: 'Consistently exceeds performance requirements.' },
  4: { label: 'Exceeds Job Requirements', description: 'Meets and at times exceeds performance requirements (above average).' },
  3: { label: 'Meets Expectations',       description: 'Job requirements are being met at a satisfactory level.' },
  2: { label: 'Needs Improvement',        description: 'Does not consistently meet the expected job requirements.' },
  1: { label: 'Unsatisfactory',           description: 'Demonstrates an unacceptable level of skills and competencies.' },
}

const ORDINALS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE']
const TYPE_LABELS: Record<string, string> = {
  positive:     'POSITIVE',
  constructive: 'CONSTRUCTIVE',
  choice:       'POSITIVE',
}

// Colors from Doc 2 (filled template)
const RUSH_PURPLE = { red: 79/255,  green: 46/255,  blue: 143/255 } // #4f2e8f
const DARK_GRAY   = { red: 51/255,  green: 51/255,  blue: 51/255  } // #333333
const MID_GRAY    = { red: 115/255, green: 115/255, blue: 115/255 } // #737373
const FONT        = 'Poppins'
const DIVIDER     = '─'.repeat(62)

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
  const p = (text: string, opts: Omit<Block, 'text'> = {}): void => { blocks.push({ text, fontFamily: FONT, ...opts }) }

  // ── Header ─────────────────────────────────────────────────────────────────
  p('Rush Media', { bold: true, italic: true, fontSize: 11, color: MID_GRAY })
  p('Employee Self-Assessment', { bold: true, fontSize: 22, color: RUSH_PURPLE, center: true, spaceBefore: 12, spaceAfter: 4 })
  p('')

  // Info block
  p(`Employee Name:  ${d.employeeName || '—'}`, { fontSize: 11 })
  p(`Position:  ${d.employeePosition || '—'}`, { fontSize: 11 })
  p(`Supervisor:  ${d.supervisorName || '—'}`, { fontSize: 11 })
  p(`Appraisal Period:  ${d.appraisalPeriod || '—'}`, { fontSize: 11 })
  p(`Date Completed:  ${d.dateCompleted || '—'}`, { fontSize: 11 })
  p('')

  // Divider
  p(DIVIDER, { fontSize: 9, color: MID_GRAY })

  // Disclaimer
  p('All employees will have an annual performance review on or around the date of their work anniversary. Merit increases are determined by several factors including financial health, Company profitability, job performance, and consumer price index. A positive performance review does not guarantee a pay raise or continued employment.', { fontSize: 9, color: MID_GRAY, italic: true })
  p('')

  // ── Part One ────────────────────────────────────────────────────────────────
  p('PART ONE — COMPETENCY EVALUATION', { bold: true, fontSize: 19, color: RUSH_PURPLE, spaceBefore: 4, spaceAfter: 4 })
  p('Consider what is working about your performance and where improvements can be made. Five competency words have been evaluated below, with specific examples for each. Please review the Competency Glossary of Terms for definitions.', { fontSize: 10, color: MID_GRAY, italic: true })
  p('')

  d.competencies.forEach((comp, i) => {
    if (!comp.term) return
    const typeLabel = TYPE_LABELS[comp.type] || 'POSITIVE'
    // Competency header: 14pt #333333 normal weight — matches Doc 2 h3 .c3
    p(`COMPETENCY ${ORDINALS[i]}  ·  ${typeLabel}:  ${comp.term}`, { fontSize: 14, color: DARK_GRAY, spaceBefore: 4, spaceAfter: 4 })
    // Definition: 10pt #737373 italic, hanging indent (margin-left 36pt, first-line -36pt)
    if (comp.definition) {
      p(comp.definition, { fontSize: 10, color: MID_GRAY, italic: true, indent: 36, hangIndent: -36 })
    }
    p('')
    p('Examples:', { bold: true, fontSize: 10 })
    const filled = comp.examples.filter(e => e?.trim())
    if (filled.length > 0) {
      filled.forEach((ex, j) => {
        p(`${j + 1}.  ${ex.trim()}`, { fontSize: 10, indent: 18, hangIndent: -18 })
      })
    } else {
      p('1.  —', { fontSize: 10, color: MID_GRAY, indent: 18, hangIndent: -18 })
    }
    p('')
  })

  // ── Part Two ────────────────────────────────────────────────────────────────
  p('PART TWO — GOALS, OBJECTIVES & ACCOMPLISHMENTS', { bold: true, fontSize: 19, color: RUSH_PURPLE, spaceBefore: 4, spaceAfter: 4 })
  p('Indicate your progress and the successful or unsuccessful completion of your goals or objectives, and explain why.', { fontSize: 10, color: MID_GRAY, italic: true })
  p('')

  const filledGoals = d.goalsObjectives.filter(g => g.description?.trim())
  if (filledGoals.length > 0) {
    filledGoals.forEach((goal, i) => {
      p(`${i + 1}.  ${goal.description.trim()}`, { bold: true, fontSize: 11 })
      if (goal.outcome) {
        const outcomeLabel = goal.outcome.charAt(0).toUpperCase() + goal.outcome.slice(1)
        p(`Outcome:  ${outcomeLabel}`, { fontSize: 10, italic: true, indent: 18, hangIndent: -18 })
      }
      if (goal.reasoning?.trim()) {
        p(`Reason:  ${goal.reasoning.trim()}`, { fontSize: 10, indent: 18, hangIndent: -18 })
      }
      p('')
    })
  } else {
    p('No goals or objectives recorded.', { fontSize: 10, color: MID_GRAY, italic: true })
    p('')
  }

  p('OVERALL PERFORMANCE RATING', { bold: true, fontSize: 11 })
  if (d.overallRating && STAR_LABELS[d.overallRating]) {
    const stars = '★'.repeat(d.overallRating) + '☆'.repeat(5 - d.overallRating)
    const rating = STAR_LABELS[d.overallRating]
    p(`${stars}  ${d.overallRating} / 5  —  ${rating.label}`, { bold: true, fontSize: 13, color: RUSH_PURPLE })
    p(rating.description, { fontSize: 10, color: MID_GRAY, italic: true })
  } else {
    p('Not rated.', { fontSize: 10, color: MID_GRAY })
  }
  p('')

  // ── Part Three ──────────────────────────────────────────────────────────────
  p("PART THREE — NEXT YEAR'S GOALS & OBJECTIVES", { bold: true, fontSize: 19, color: RUSH_PURPLE, spaceBefore: 4, spaceAfter: 4 })
  p('Identify goals you anticipate or want to complete over the next review period, along with objectives on how you plan to reach them. These are subject to change based on your evaluation discussion with your manager.', { fontSize: 10, color: MID_GRAY, italic: true })
  p('')

  const filledNextGoals = d.nextYearGoals.filter(g => g.goal?.trim())
  if (filledNextGoals.length > 0) {
    filledNextGoals.forEach((goal, i) => {
      p(`${i + 1}.  Goal:  ${goal.goal.trim()}`, { bold: true, fontSize: 11 })
      if (goal.objective?.trim()) {
        p(`Objective / Roadmap:  ${goal.objective.trim()}`, { fontSize: 10, indent: 18, hangIndent: -18 })
      }
      p('')
    })
  } else {
    p('No next-year goals recorded.', { fontSize: 10, color: MID_GRAY, italic: true })
    p('')
  }

  // ── Signature block ─────────────────────────────────────────────────────────
  p(DIVIDER, { fontSize: 9, color: MID_GRAY })
  p('')
  p(`Employee Name:  ${d.employeeName}`, { fontSize: 11 })
  p('')
  p('Employee Signature:  ___________________________________', { fontSize: 11 })
  p('')
  p('Date Signed:  ________________', { fontSize: 11 })

  return blocks
}

// ── Convert blocks → Google Docs batchUpdate requests ──────────────────────────
function blocksToRequests(blocks: Block[]): { fullText: string; requests: docs_v1.Schema$Request[] } {
  let fullText = ''
  const segments: Array<{ start: number; end: number; block: Block }> = []

  for (const block of blocks) {
    const start = fullText.length + 1
    fullText += block.text + '\n'
    const end = fullText.length + 1
    segments.push({ start, end, block })
  }

  const requests: docs_v1.Schema$Request[] = []
  requests.push({ insertText: { location: { index: 1 }, text: fullText } })

  for (const { start, end, block } of [...segments].reverse()) {
    if (start >= end) continue

    // Paragraph style
    const hasParagraphStyle = block.center || block.spaceBefore !== undefined || block.spaceAfter !== undefined || block.indent || block.hangIndent
    if (hasParagraphStyle) {
      const paraStyle: docs_v1.Schema$ParagraphStyle = { namedStyleType: 'NORMAL_TEXT' }
      const paraFields: string[] = ['namedStyleType']

      if (block.center) { paraStyle.alignment = 'CENTER'; paraFields.push('alignment') }
      if (block.spaceBefore !== undefined) { paraStyle.spaceAbove = { magnitude: block.spaceBefore, unit: 'PT' }; paraFields.push('spaceAbove') }
      if (block.spaceAfter !== undefined)  { paraStyle.spaceBelow = { magnitude: block.spaceAfter,  unit: 'PT' }; paraFields.push('spaceBelow') }
      if (block.indent)     { paraStyle.indentStart     = { magnitude: block.indent,     unit: 'PT' }; paraFields.push('indentStart') }
      if (block.hangIndent) { paraStyle.indentFirstLine = { magnitude: block.hangIndent, unit: 'PT' }; paraFields.push('indentFirstLine') }

      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: paraStyle,
          fields: paraFields.join(','),
        },
      })
    }

    // Text style
    const hasTextStyle = block.bold !== undefined || block.italic !== undefined || block.fontSize || block.color || block.fontFamily
    if (hasTextStyle) {
      const textStyle: docs_v1.Schema$TextStyle = {}
      const textFields: string[] = []

      if (block.bold      !== undefined) { textStyle.bold      = block.bold;      textFields.push('bold') }
      if (block.italic    !== undefined) { textStyle.italic    = block.italic;    textFields.push('italic') }
      if (block.fontSize)                { textStyle.fontSize  = { magnitude: block.fontSize, unit: 'PT' }; textFields.push('fontSize') }
      if (block.color)                   { textStyle.foregroundColor = { color: { rgbColor: block.color } }; textFields.push('foregroundColor') }
      if (block.fontFamily)              { textStyle.weightedFontFamily = { fontFamily: block.fontFamily }; textFields.push('weightedFontFamily') }

      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle,
          fields: textFields.join(','),
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
      const serviceClient = createServiceClient()
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
