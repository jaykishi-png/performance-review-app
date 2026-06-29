import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'

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

// White-background palette — all values legible on white
const INDIGO   = '#4f46e5'
const BODY     = '#111827'   // near-black for all body text
const SUBHEAD  = '#374151'   // dark grey for sub-titles
const LABEL    = '#6b7280'   // medium grey for key labels
const DIVIDER  = '#d1d5db'   // light grey rule

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

type Doc = PDFKit.PDFDocument

function W(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function sectionTitle(doc: Doc, title: string) {
  doc.moveDown(0.8)
  doc.rect(doc.page.margins.left, doc.y, W(doc), 1.5).fill(INDIGO)
  doc.moveDown(0.35)
  doc.fontSize(11.5).fillColor(INDIGO).font('Helvetica-Bold').text(title.toUpperCase(), { characterSpacing: 0.5 })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10).fillColor(BODY)
}

function subhead(doc: Doc, title: string) {
  doc.moveDown(0.5)
  doc.fontSize(10.5).fillColor(SUBHEAD).font('Helvetica-Bold').text(title)
  doc.moveDown(0.2)
  doc.font('Helvetica').fontSize(10).fillColor(BODY)
}

function kv(doc: Doc, key: string, value: string | null | undefined) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(LABEL).text(key.toUpperCase(), { characterSpacing: 0.3 })
  doc.font('Helvetica').fontSize(10).fillColor(BODY).text(value?.trim() || '—', { width: W(doc) })
  doc.moveDown(0.25)
}

function rule(doc: Doc) {
  doc.moveDown(0.4)
  doc.rect(doc.page.margins.left, doc.y, W(doc), 0.5).fill(DIVIDER)
  doc.moveDown(0.5)
}

function smallLabel(doc: Doc, label: string) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(SUBHEAD).text(label)
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
    const reviewsAsEmployee = (reviewsAsEmployeeRes.data ?? []) as Record<string, unknown>[]

    // Resolve manager UUIDs to names
    const managerIds = [...new Set(reviewsAsEmployee.map(r => r.user_id as string).filter(Boolean))]
    let managerNames: Record<string, string> = {}
    if (managerIds.length) {
      const { data: mp } = await serviceClient.from('profiles').select('id, name, email').in('id', managerIds)
      if (mp) {
        managerNames = Object.fromEntries(
          (mp as { id: string; name?: string; email?: string }[])
            .map(p => [p.id, p.name?.trim() || p.email?.trim() || p.id])
        )
      }
    }

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const doc = new PDFDocument({
      margin: 50,
      size: 'LETTER',
      bufferPages: true,
      info: {
        Title: `User Data Export — ${String(profile?.name ?? profile?.email ?? targetId)}`,
        Author: 'InnoSupps HR Platform',
      },
    })

    // ── Cover header ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 100).fill(INDIGO)
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff').text('User Data Export', 50, 28)
    doc.fontSize(11.5).font('Helvetica').fillColor('rgba(255,255,255,0.85)')
      .text(`${String(profile?.name ?? profile?.email ?? targetId)}  ·  Exported ${fmtDate(new Date().toISOString())}`, 50, 57)
    doc.fontSize(8.5).fillColor('rgba(255,255,255,0.55)').text('InnoSupps HR Platform  ·  Confidential', 50, 79)
    doc.y = 118
    doc.font('Helvetica').fontSize(10).fillColor(BODY)

    // ── Profile ────────────────────────────────────────────────────────────────
    sectionTitle(doc, 'Profile')
    if (profile) {
      kv(doc, 'Name', String(profile.name ?? '—'))
      kv(doc, 'Email', String(profile.email ?? '—'))
      kv(doc, 'Role', String(profile.role ?? '—'))
      kv(doc, 'Position', String(profile.position ?? '—'))
      kv(doc, 'Division', String(profile.division ?? '—'))
      kv(doc, 'Status', (profile.is_active as boolean) ? 'Active' : 'Inactive')
      kv(doc, 'Start Date', fmtDate(profile.start_date as string))
      kv(doc, 'Member Since', fmtDate(profile.created_at as string))
    }

    // ── Reviews authored by this manager ──────────────────────────────────────
    const reviewsAsManager = (reviewsAsManagerRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `Reviews Written as Manager (${reviewsAsManager.length})`)
    if (reviewsAsManager.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      reviewsAsManager.forEach((r, i) => {
        subhead(doc, `Review ${i + 1} — ${String(r.employee_name ?? '—')}`)
        kv(doc, 'Employee', String(r.employee_name ?? '—'))
        kv(doc, 'Position', String(r.employee_position ?? '—'))
        kv(doc, 'Manager Signed', fmtDate(r.manager_signed_at as string))
        kv(doc, 'Employee Signed', fmtDate(r.employee_signed_at as string))
        kv(doc, 'Admin Approved', fmtDate(r.admin_approved_at as string))

        const fd = r.form_data as Record<string, unknown> | null
        if (fd) {
          renderReviewFormData(doc, fd)
        }
        rule(doc)
      })
    }

    // ── Reviews received as employee ──────────────────────────────────────────
    sectionTitle(doc, `Performance Reviews Received (${reviewsAsEmployee.length})`)
    if (reviewsAsEmployee.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      reviewsAsEmployee.forEach((r, i) => {
        const managerName = managerNames[r.user_id as string] ?? String(r.user_id ?? '—')
        subhead(doc, `Review ${i + 1} — by ${managerName}`)
        kv(doc, 'Manager', managerName)
        kv(doc, 'Position', String(r.employee_position ?? '—'))
        kv(doc, 'Manager Signed', fmtDate(r.manager_signed_at as string))
        kv(doc, 'Employee Signed', fmtDate(r.employee_signed_at as string))
        kv(doc, 'Admin Approved', fmtDate(r.admin_approved_at as string))

        const fd = r.form_data as Record<string, unknown> | null
        if (fd) {
          renderReviewFormData(doc, fd)
        }
        rule(doc)
      })
    }

    // ── Self Reviews ──────────────────────────────────────────────────────────
    const selfReviews = (selfReviewRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `Self-Assessments (${selfReviews.length})`)
    if (selfReviews.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      selfReviews.forEach((s, i) => {
        subhead(doc, `Self-Assessment ${i + 1}`)
        kv(doc, 'Status', String(s.status ?? '—'))
        kv(doc, 'Overall Rating', s.overall_rating ? String(s.overall_rating) : '—')
        kv(doc, 'Submitted', fmtDate(s.submitted_at as string))
        kv(doc, 'Last Updated', fmtDate(s.updated_at as string))
        if (s.strengths) kv(doc, 'Strengths', String(s.strengths))
        if (s.growth_areas) kv(doc, 'Growth Areas', String(s.growth_areas))
        if (s.overall_comments) kv(doc, 'Overall Comments', String(s.overall_comments))

        const comps = s.competencies as { type?: string; term?: string; examples?: string[] }[] | null
        if (comps?.some(c => c.term)) {
          doc.moveDown(0.3)
          smallLabel(doc, 'Competencies:')
          comps.filter(c => c.term).forEach((c, ci) => {
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BODY)
              .text(`  ${ci + 1}. [${c.type ?? '—'}]  ${c.term}`)
            const examples = (c.examples ?? []).filter(e => e?.trim())
            examples.forEach((ex, ei) => {
              doc.font('Helvetica').fontSize(9).fillColor(BODY)
                .text(`     Example ${ei + 1}: ${ex}`, { width: W(doc), indent: 12 })
            })
            doc.moveDown(0.1)
          })
        }

        const goalsObj = s.goals_objectives as { description?: string; outcome?: string; reasoning?: string }[] | null
        if (goalsObj?.some(g => g.description?.trim())) {
          doc.moveDown(0.3)
          smallLabel(doc, 'Goals & Objectives (Current Year):')
          goalsObj.filter(g => g.description?.trim()).forEach((g, gi) => {
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BODY).text(`  Goal ${gi + 1}: ${g.description}`)
            if (g.outcome?.trim()) doc.font('Helvetica').fontSize(9).fillColor(BODY).text(`    Outcome: ${g.outcome}`, { width: W(doc) - 20, indent: 16 })
            if (g.reasoning?.trim()) doc.font('Helvetica').fontSize(9).fillColor(BODY).text(`    Reasoning: ${g.reasoning}`, { width: W(doc) - 20, indent: 16 })
            doc.moveDown(0.1)
          })
        }

        const nextYearGoals = s.next_year_goals as { goal?: string; objective?: string }[] | null
        if (nextYearGoals?.some(g => g.goal?.trim())) {
          doc.moveDown(0.3)
          smallLabel(doc, 'Next Year Goals:')
          nextYearGoals.filter(g => g.goal?.trim()).forEach((g, gi) => {
            doc.font('Helvetica').fontSize(9.5).fillColor(BODY)
              .text(`  ${gi + 1}. ${g.goal}${g.objective?.trim() ? ` — ${g.objective}` : ''}`, { width: W(doc) })
            doc.moveDown(0.1)
          })
        }
        rule(doc)
      })
    }

    // ── Goals ─────────────────────────────────────────────────────────────────
    const goals = (goalsRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `Employee Goals (${goals.length})`)
    if (goals.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      goals.forEach((g, i) => {
        subhead(doc, `Goal ${i + 1} — ${String(g.title ?? '—')}`)
        kv(doc, 'Status', String(g.status ?? '—'))
        kv(doc, 'Target Date', fmtDate(g.target_date as string))
        if (g.description) kv(doc, 'Description', String(g.description))
        doc.moveDown(0.2)
      })
    }

    // ── 1:1 Notes ─────────────────────────────────────────────────────────────
    const notes = (notesRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `1:1 Meeting Notes (${notes.length})`)
    if (notes.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      notes.forEach((n, i) => {
        subhead(doc, `Note ${i + 1} — ${fmtDate(n.meeting_date as string)}`)
        kv(doc, 'Meeting Date', fmtDate(n.meeting_date as string))
        if (Array.isArray(n.tags) && (n.tags as string[]).length > 0) {
          kv(doc, 'Tags', (n.tags as string[]).join(', '))
        }
        kv(doc, 'Note', String(n.note ?? '—'))
        doc.moveDown(0.2)
      })
    }

    // ── PIPs ──────────────────────────────────────────────────────────────────
    const pipsAsManager = (pipsAsManagerRes.data ?? []) as Record<string, unknown>[]
    const pipsAsEmployee = (pipsAsEmployeeRes.data ?? []) as Record<string, unknown>[]
    const allPips: (Record<string, unknown> & { _role: string })[] = [
      ...pipsAsManager.map(p => ({ ...p, _role: 'Manager' })),
      ...pipsAsEmployee.map(p => ({ ...p, _role: 'Employee' })),
    ]
    sectionTitle(doc, `Performance Improvement Plans (${allPips.length})`)
    if (allPips.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      allPips.forEach((p, i) => {
        subhead(doc, `PIP ${i + 1} — ${String(p.title ?? '—')} (${p._role})`)
        kv(doc, 'Role in PIP', String(p._role))
        kv(doc, 'Title', String(p.title ?? '—'))
        kv(doc, 'Status', String(p.status ?? '—'))
        kv(doc, 'Start Date', fmtDate(p.start_date as string))
        kv(doc, 'Target Date', fmtDate(p.target_date as string))
        kv(doc, 'Reason', String(p.reason ?? '—'))

        const milestones = p.milestones as { text?: string; completed?: boolean }[] | null
        if (milestones?.length) {
          doc.moveDown(0.2)
          smallLabel(doc, `Milestones (${milestones.length}):`)
          milestones.forEach((m, mi) => {
            const tick = m.completed ? '[x]' : '[ ]'
            doc.font('Helvetica').fontSize(9.5).fillColor(BODY)
              .text(`  ${tick} ${mi + 1}. ${m.text ?? '—'}`, { width: W(doc) })
          })
        }
        rule(doc)
      })
    }

    // ── Quarterly Check-ins ───────────────────────────────────────────────────
    const checkins = (checkinsRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `Quarterly Check-ins (${checkins.length})`)
    if (checkins.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      checkins.forEach((c, i) => {
        subhead(doc, `Check-in ${i + 1} — Q${c.quarter ?? '?'} ${c.year ?? '?'}`)
        kv(doc, 'Quarter / Year', `Q${c.quarter ?? '?'} ${c.year ?? '?'}`)
        kv(doc, 'Employee Submitted', fmtDate(c.employee_submitted_at as string))
        kv(doc, 'Manager Submitted', fmtDate(c.manager_submitted_at as string))
        if (c.q1_strengths) kv(doc, 'Strengths', String(c.q1_strengths))
        if (c.q1_improvements) kv(doc, 'Improvements', String(c.q1_improvements))
        if (c.q1_goals) kv(doc, 'Goals', String(c.q1_goals))
        if (c.manager_comments) kv(doc, 'Manager Comments', String(c.manager_comments))
        doc.moveDown(0.2)
      })
    }

    // ── Peer Feedback ─────────────────────────────────────────────────────────
    const peerFeedback = (peerFeedbackRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `Peer Feedback Requests (${peerFeedback.length})`)
    if (peerFeedback.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      peerFeedback.forEach((f, i) => {
        subhead(doc, `Request ${i + 1}`)
        kv(doc, 'Status', String(f.status ?? '—'))
        kv(doc, 'Year', String(f.year ?? '—'))
        if (f.feedback_text) kv(doc, 'Feedback', String(f.feedback_text))
        if (f.strengths) kv(doc, 'Strengths', String(f.strengths))
        if (f.growth_areas) kv(doc, 'Growth Areas', String(f.growth_areas))
        doc.moveDown(0.2)
      })
    }

    // ── Audit Log ─────────────────────────────────────────────────────────────
    const auditLogs = (auditRes.data ?? []) as Record<string, unknown>[]
    sectionTitle(doc, `Audit Log (${auditLogs.length} entries)`)
    if (auditLogs.length === 0) {
      doc.fontSize(10).fillColor(LABEL).text('None on record.').moveDown(0.3)
    } else {
      auditLogs.slice(0, 100).forEach(l => {
        doc.font('Helvetica').fontSize(8.5).fillColor(BODY)
          .text(
            `${fmtDate(l.created_at as string)}  ·  ${String(l.action ?? '—')}  ·  ${String(l.target_type ?? '')} ${String(l.target_id ?? '')}`.trim(),
            { width: W(doc) }
          )
      })
      if (auditLogs.length > 100) {
        doc.moveDown(0.3).fillColor(LABEL).text(`… and ${auditLogs.length - 100} more entries`)
      }
    }

    // Footer on each buffered page — lineBreak:false prevents phantom page creation
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      doc.fontSize(7.5).fillColor(LABEL)
        .text(
          `Page ${i + 1} of ${range.count}  ·  Confidential — InnoSupps HR Platform`,
          50,
          doc.page.height - 32,
          { align: 'center', width: doc.page.width - 100, lineBreak: false }
        )
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

// ── Review form_data renderer (shared by manager + employee review sections) ──

type CompEntry = { competency?: string; examples?: string[] } | null
type GoalEntry = { text?: string; status?: string; explanation?: string }
type NextGoal  = { text?: string; targetDate?: string }

function renderReviewFormData(doc: Doc, fd: Record<string, unknown>) {
  const scoreLabels: Record<number, string> = {
    1: 'Unsatisfactory', 2: 'Below Expectations', 3: 'Meets Expectations',
    4: 'Exceeds Expectations', 5: 'Outstanding',
  }

  kv(doc, 'Appraisal Period', String(fd.appraisalPeriod ?? '—'))
  kv(doc, 'Review Date', fmtDate(fd.reviewDate as string))
  const score = fd.overallScore as number | null
  kv(doc, 'Overall Score', score ? `${score} / 5 — ${scoreLabels[score] ?? ''}` : '—')
  if (fd.overallSummary) kv(doc, 'Overall Summary', String(fd.overallSummary))

  const compKeys = [
    ['competencyOne',   'Positive'],
    ['competencyTwo',   'Positive'],
    ['competencyThree', 'Constructive'],
    ['competencyFour',  'Constructive'],
    ['competencyFive',  fd.competencyFiveType === 'constructive' ? 'Constructive' : 'Positive'],
  ] as [string, string][]

  const filledComps = compKeys.filter(([k]) => {
    const c = fd[k] as CompEntry
    return c?.competency?.trim()
  })

  if (filledComps.length) {
    doc.moveDown(0.3)
    smallLabel(doc, 'Competencies:')
    filledComps.forEach(([k, type], ci) => {
      const c = fd[k] as { competency?: string; examples?: string[] }
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BODY)
        .text(`  ${ci + 1}. [${type}]  ${c.competency}`)
      const examples = (c.examples ?? []).filter(e => e?.trim())
      examples.forEach((ex, ei) => {
        doc.font('Helvetica').fontSize(9).fillColor(BODY)
          .text(`     Example ${ei + 1}: ${ex}`, {
            width: W(doc) - 12,
            indent: 12,
          })
      })
      doc.moveDown(0.12)
    })
  }

  const goals = fd.goals as GoalEntry[] | null
  if (goals?.some(g => g.text?.trim())) {
    doc.moveDown(0.3)
    smallLabel(doc, 'Goals & Performance:')
    goals.filter(g => g.text?.trim()).forEach((g, gi) => {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BODY).text(`  Goal ${gi + 1}: ${g.text}`)
      if (g.status) doc.font('Helvetica').fontSize(8.5).fillColor(LABEL).text(`    Status: ${g.status}`)
      if (g.explanation?.trim()) {
        doc.font('Helvetica').fontSize(9).fillColor(BODY)
          .text(`    ${g.explanation}`, { width: W(doc) - 20, indent: 16 })
      }
      doc.moveDown(0.1)
    })
  }

  const nextGoals = fd.nextGoals as NextGoal[] | null
  if (nextGoals?.some(g => g.text?.trim())) {
    doc.moveDown(0.3)
    smallLabel(doc, 'Next Year Goals:')
    nextGoals.filter(g => g.text?.trim()).forEach((g, gi) => {
      doc.font('Helvetica').fontSize(9.5).fillColor(BODY)
        .text(
          `  ${gi + 1}. ${g.text}${g.targetDate ? `  (Target: ${fmtDate(g.targetDate)})` : ''}`,
          { width: W(doc) }
        )
      doc.moveDown(0.1)
    })
  }
}
