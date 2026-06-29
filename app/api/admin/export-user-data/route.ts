import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── helpers ───────────────────────────────────────────────────────────────────

function bufferFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

const DARK = '#1a1a2e'
const INDIGO = '#4f46e5'
const GRAY = '#6b7280'
const LIGHT = '#f0f2fa'
const GREEN = '#34d399'

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8)
  doc.rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 1).fill(INDIGO)
  doc.moveDown(0.3)
  doc.fontSize(13).fillColor(INDIGO).font('Helvetica-Bold').text(title.toUpperCase(), { characterSpacing: 0.5 })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
}

function addKV(doc: PDFKit.PDFDocument, key: string, value: string) {
  const x = doc.page.margins.left
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text(key.toUpperCase(), x, doc.y, { continued: false, characterSpacing: 0.3 })
  doc.font('Helvetica').fontSize(10).fillColor(LIGHT).text(value || '—', { indent: 0 })
  doc.moveDown(0.15)
}

function addCard(doc: PDFKit.PDFDocument, lines: [string, string][], title?: string) {
  const margin = doc.page.margins.left
  const w = doc.page.width - margin - doc.page.margins.right
  const startY = doc.y
  if (title) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(LIGHT).text(title, margin, startY)
    doc.moveDown(0.2)
  }
  lines.forEach(([k, v]) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GRAY).text(k.toUpperCase(), margin, doc.y, { characterSpacing: 0.2 })
    doc.font('Helvetica').fontSize(9.5).fillColor('#d1d5db').text(v || '—', { width: w })
    doc.moveDown(0.15)
  })
  doc.moveDown(0.4)
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
    const { data: actorProfile } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
    const actorRole = (actorProfile as { role: string } | null)?.role
    if (actorRole !== 'admin' && actorRole !== 'dev_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetId = req.nextUrl.searchParams.get('userId')
    if (!targetId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const [
      profileRes,
      reviewsAsManagerRes,
      reviewsAsEmployeeRes,
      selfReviewRes,
      goalsRes,
      notesRes,
      pipsAsManagerRes,
      pipsAsEmployeeRes,
      checkinsRes,
      peerFeedbackRes,
      auditRes,
    ] = await Promise.all([
      serviceClient.from('profiles').select('*').eq('id', targetId).single(),
      serviceClient.from('reviews').select('*').eq('user_id', targetId),
      serviceClient.from('reviews').select('*').eq('employee_id', targetId),
      serviceClient.from('self_reviews').select('*').eq('employee_id', targetId),
      serviceClient.from('employee_goals').select('*').eq('employee_id', targetId),
      serviceClient.from('one_on_one_notes').select('*').eq('employee_id', targetId).order('meeting_date', { ascending: false }),
      serviceClient.from('pip_plans').select('*').eq('manager_id', targetId),
      serviceClient.from('pip_plans').select('*').eq('employee_id', targetId),
      serviceClient.from('quarterly_checkins').select('*').eq('employee_id', targetId),
      serviceClient.from('feedback_requests').select('*').or(`requestor_id.eq.${targetId},reviewer_id.eq.${targetId}`),
      serviceClient.from('audit_logs').select('*').or(`actor_user_id.eq.${targetId},target_id.eq.${targetId}`).order('created_at', { ascending: false }).limit(200),
    ])

    const profile = profileRes.data as Record<string, unknown> | null

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50, size: 'LETTER', bufferPages: true, info: { Title: `User Data Export — ${profile?.name ?? profile?.email ?? targetId}`, Author: 'InnoSupps HR Platform' } })

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0b0d14')

    // Cover header bar
    doc.rect(0, 0, doc.page.width, 110).fill(INDIGO)
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff').text('User Data Export', 50, 30)
    doc.fontSize(12).font('Helvetica').fillColor('rgba(255,255,255,0.75)').text(`${String(profile?.name ?? profile?.email ?? targetId)}  ·  Exported ${fmtDate(new Date().toISOString())}`, 50, 58)
    doc.fontSize(9).fillColor('rgba(255,255,255,0.5)').text('InnoSupps HR Platform  ·  Confidential', 50, 82)

    doc.y = 130
    doc.font('Helvetica').fontSize(10).fillColor('#d1d5db')

    // ── Profile ────────────────────────────────────────────────────────────────
    addSectionTitle(doc, 'Profile')
    if (profile) {
      addKV(doc, 'Name', String(profile.name ?? '—'))
      addKV(doc, 'Email', String(profile.email ?? '—'))
      addKV(doc, 'Role', String(profile.role ?? '—'))
      addKV(doc, 'Position', String(profile.position ?? '—'))
      addKV(doc, 'Division', String(profile.division ?? '—'))
      addKV(doc, 'Status', (profile.is_active as boolean) ? 'Active' : 'Inactive')
      addKV(doc, 'Start Date', fmtDate(profile.start_date as string))
      addKV(doc, 'Member Since', fmtDate(profile.created_at as string))
    }

    // ── Reviews authored by this manager ──────────────────────────────────────
    const reviewsAsManager = (reviewsAsManagerRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Reviews Written by This Manager (${reviewsAsManager.length})`)
    if (reviewsAsManager.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      reviewsAsManager.forEach((r, i) => {
        addCard(doc, [
          ['Employee', String(r.employee_name ?? '—')],
          ['Position', String(r.employee_position ?? '—')],
          ['Progress', `Step ${r.step ?? 0} of ${r.max_step ?? 0}`],
          ['Manager Signed', fmtDate(r.manager_signed_at as string)],
          ['Employee Signed', fmtDate(r.employee_signed_at as string)],
          ['Saved', fmtDate(r.saved_at as string)],
        ], `Review ${i + 1}`)
      })
    }

    // ── Reviews received as employee ──────────────────────────────────────────
    const reviewsAsEmployee = (reviewsAsEmployeeRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Performance Reviews Received (${reviewsAsEmployee.length})`)
    if (reviewsAsEmployee.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      reviewsAsEmployee.forEach((r, i) => {
        addCard(doc, [
          ['Manager', String(r.user_id ?? '—')],
          ['Position', String(r.employee_position ?? '—')],
          ['Manager Signed', fmtDate(r.manager_signed_at as string)],
          ['Employee Signed', fmtDate(r.employee_signed_at as string)],
          ['Admin Approved', fmtDate(r.admin_approved_at as string)],
        ], `Review ${i + 1}`)
      })
    }

    // ── Self Reviews ──────────────────────────────────────────────────────────
    const selfReviews = (selfReviewRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Self-Assessments (${selfReviews.length})`)
    if (selfReviews.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      selfReviews.forEach((s, i) => {
        addCard(doc, [
          ['Status', String(s.status ?? '—')],
          ['Overall Rating', String(s.overall_rating ?? '—')],
          ['Submitted', fmtDate(s.submitted_at as string)],
          ['Last Updated', fmtDate(s.updated_at as string)],
        ], `Self-Assessment ${i + 1}`)
      })
    }

    // ── Goals ─────────────────────────────────────────────────────────────────
    const goals = (goalsRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Goals (${goals.length})`)
    if (goals.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      goals.forEach((g, i) => {
        addCard(doc, [
          ['Title', String(g.title ?? '—')],
          ['Status', String(g.status ?? '—')],
          ['Target Date', fmtDate(g.target_date as string)],
          ['Description', String(g.description ?? '—')],
        ], `Goal ${i + 1}`)
      })
    }

    // ── 1:1 Notes ─────────────────────────────────────────────────────────────
    const notes = (notesRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `1:1 Meeting Notes (${notes.length})`)
    if (notes.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      notes.forEach((n, i) => {
        addCard(doc, [
          ['Meeting Date', fmtDate(n.meeting_date as string)],
          ['Tags', Array.isArray(n.tags) ? (n.tags as string[]).join(', ') : '—'],
          ['Note', String(n.note ?? '—').slice(0, 400) + (String(n.note ?? '').length > 400 ? '…' : '')],
        ], `Note ${i + 1}`)
      })
    }

    // ── PIPs ──────────────────────────────────────────────────────────────────
    const pipsAsManager = (pipsAsManagerRes.data ?? []) as Record<string, unknown>[]
    const pipsAsEmployee = (pipsAsEmployeeRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Performance Improvement Plans (${pipsAsManager.length + pipsAsEmployee.length})`)
    const allPips: (Record<string, unknown> & { _role: string })[] = [
      ...pipsAsManager.map(p => ({ ...p, _role: 'Manager' })),
      ...pipsAsEmployee.map(p => ({ ...p, _role: 'Employee' })),
    ]
    if (allPips.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      allPips.forEach((p, i) => {
        addCard(doc, [
          ['Role', String(p._role)],
          ['Title', String(p.title ?? '—')],
          ['Status', String(p.status ?? '—')],
          ['Start Date', fmtDate(p.start_date as string)],
          ['Target Date', fmtDate(p.target_date as string)],
          ['Reason', String(p.reason ?? '—').slice(0, 300)],
        ], `PIP ${i + 1}`)
      })
    }

    // ── Quarterly Check-ins ───────────────────────────────────────────────────
    const checkins = (checkinsRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Quarterly Check-ins (${checkins.length})`)
    if (checkins.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      checkins.forEach((c, i) => {
        addCard(doc, [
          ['Quarter / Year', `Q${c.quarter ?? '?'} ${c.year ?? '?'}`],
          ['Employee Submitted', fmtDate(c.employee_submitted_at as string)],
          ['Manager Submitted', fmtDate(c.manager_submitted_at as string)],
        ], `Check-in ${i + 1}`)
      })
    }

    // ── Peer Feedback ─────────────────────────────────────────────────────────
    const peerFeedback = (peerFeedbackRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Peer Feedback Requests (${peerFeedback.length})`)
    if (peerFeedback.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      peerFeedback.forEach((f, i) => {
        addCard(doc, [
          ['Status', String(f.status ?? '—')],
          ['Year', String(f.year ?? '—')],
        ], `Request ${i + 1}`)
      })
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────
    const auditLogs = (auditRes.data ?? []) as Record<string, unknown>[]
    addSectionTitle(doc, `Audit Log (${auditLogs.length} entries)`)
    if (auditLogs.length === 0) {
      doc.fontSize(10).fillColor(GRAY).text('None on record.').moveDown(0.3)
    } else {
      auditLogs.slice(0, 100).forEach((l) => {
        doc.font('Helvetica').fontSize(8.5).fillColor('#9ca3af')
          .text(`${fmtDate(l.created_at as string)}  ·  ${String(l.action ?? '—')}  ·  ${String(l.target_type ?? '')} ${String(l.target_id ?? '')}`)
      })
      if (auditLogs.length > 100) {
        doc.moveDown(0.3).fillColor(GRAY).text(`… and ${auditLogs.length - 100} more entries`)
      }
    }

    // Footer on each page
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      doc.fontSize(8).fillColor(GRAY)
        .text(`Page ${i + 1} of ${range.count}  ·  Confidential — InnoSupps HR Platform`, 50, doc.page.height - 35, { align: 'center', width: doc.page.width - 100 })
    }

    doc.end()
    const buffer = await bufferFromStream(doc)

    const safeFileName = `user-data-export-${String(profile?.name ?? profile?.email ?? targetId).replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('[export-user-data]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
