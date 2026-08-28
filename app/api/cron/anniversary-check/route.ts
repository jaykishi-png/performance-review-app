// @ts-nocheck
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
  'https://performance-review-app-git-main-automation-7724s-projects.vercel.app'

// ── Email templates ────────────────────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#13151f;border:1px solid #1e2130;border-radius:16px;padding:36px 32px;">
      ${content}
      <p style="margin:28px 0 0;font-size:11px;color:#374151;line-height:1.5;">This is an automated reminder from your performance review system.</p>
    </div>
  </div>
</body></html>`
}

function emailCTA(href: string, text: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:11px 24px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>`
}

function urgencyBadge(daysLeft: number) {
  const color = daysLeft <= 1 ? '#ef4444' : daysLeft <= 3 ? '#f59e0b' : '#818cf8'
  const label = daysLeft <= 1 ? 'Due Tomorrow' : daysLeft <= 3 ? `${daysLeft} Days Left` : 'Halfway Reminder'
  return `<span style="display:inline-block;padding:3px 10px;background:${color}22;color:${color};border-radius:20px;font-size:11px;font-weight:700;margin-bottom:12px;">${label}</span>`
}

function saReminderEmail(empName: string, dueDate: string, daysLeft: number) {
  return emailWrapper(`
    ${urgencyBadge(daysLeft)}
    <div style="font-size:24px;margin-bottom:14px;">📝</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Reminder: Complete your self-assessment</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      Hi ${empName}, your self-assessment is due <strong style="color:#f0f2fa;">${dueDate}</strong>.
      ${daysLeft <= 1 ? ' Please complete it today to avoid missing the deadline.' : ' Don\'t forget to submit before the deadline.'}
    </p>
    ${emailCTA(`${APP_URL}/employee`, 'Complete Self-Assessment')}`)
}

function reviewReminderEmail(empName: string, empPos: string, dueDate: string, daysLeft: number) {
  return emailWrapper(`
    ${urgencyBadge(daysLeft)}
    <div style="font-size:24px;margin-bottom:14px;">📋</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Reminder: Complete ${empName}'s performance review</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      The performance review for <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) is due <strong style="color:#f0f2fa;">${dueDate}</strong>.
      ${daysLeft <= 1 ? ' Please complete and export it today.' : ''}
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'Complete Review')}`)
}

function reviewReminderAdminEmail(empName: string, empPos: string, mgrName: string, dueDate: string, daysLeft: number) {
  return emailWrapper(`
    ${urgencyBadge(daysLeft)}
    <div style="font-size:24px;margin-bottom:14px;">📊</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName}'s review deadline is approaching</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      <strong style="color:#f0f2fa;">${mgrName}</strong> has until <strong style="color:#f0f2fa;">${dueDate}</strong> to complete the performance review for ${empName} (${empPos}).
    </p>
    ${emailCTA(`${APP_URL}/admin`, 'View in Admin Portal')}`)
}

function meetingReminderEmail(empName: string, empPos: string, dueDate: string, daysLeft: number) {
  return emailWrapper(`
    ${urgencyBadge(daysLeft)}
    <div style="font-size:24px;margin-bottom:14px;">🤝</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Reminder: Schedule your 1-on-1 with ${empName}</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      The meeting and signing window for <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) closes <strong style="color:#f0f2fa;">${dueDate}</strong>.
      ${daysLeft <= 1 ? ' Please complete the meeting and collect signatures today.' : ''}
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'View Review & Sign')}`)
}

function saOpenEmail(empName: string, dueDate: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">📝</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Your annual self-assessment is now open</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      Hi ${empName}, your annual performance review cycle has started. Please complete your self-assessment by <strong style="color:#f0f2fa;">${dueDate}</strong>.
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
      Your self-assessment helps you reflect on the past year, highlight your accomplishments, and set goals for the year ahead.
    </p>
    ${emailCTA(`${APP_URL}/employee`, 'Complete Self-Assessment')}`)
}

function managerSAOpenEmail(empName: string, empPos: string, dueDate: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">🔔</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName}'s self-assessment period has started</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) has started their annual review cycle. They have until <strong style="color:#f0f2fa;">${dueDate}</strong> to complete their self-assessment.
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
      After they submit, you'll have two weeks to complete your performance review.
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'View Manager Portal')}`)
}

function saSubmittedEmail(empName: string, empPos: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">✅</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName} submitted their self-assessment</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) has submitted their self-assessment. You can now view it in your manager portal and begin your performance review.
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'View Self-Assessment')}`)
}

function reviewOpenEmail(empName: string, empPos: string, dueDate: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">📋</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Performance review window is now open</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      It's time to complete the performance review for <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}). Please complete and export the review by <strong style="color:#f0f2fa;">${dueDate}</strong>.
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'Start Performance Review')}`)
}

function reviewOpenAdminEmail(empName: string, empPos: string, mgrName: string, dueDate: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">📊</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName}'s review period has opened</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      ${mgrName} has until <strong style="color:#f0f2fa;">${dueDate}</strong> to complete the performance review for ${empName} (${empPos}).
    </p>
    ${emailCTA(`${APP_URL}/admin`, 'View in Admin Portal')}`)
}

function meetingEmail(empName: string, empPos: string, dueDate: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">🤝</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Schedule your 1-on-1 with ${empName}</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      The meeting and signing window for <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) is now open. Please facilitate the review meeting and have both parties sign by <strong style="color:#f0f2fa;">${dueDate}</strong>.
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'View Review & Sign')}`)
}

function meetingAdminEmail(empName: string, empPos: string, mgrName: string, dueDate: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">📅</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName}'s 1-on-1 meeting window is open</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      ${mgrName} has until <strong style="color:#f0f2fa;">${dueDate}</strong> to facilitate the review meeting with ${empName} (${empPos}) and collect both signatures.
    </p>
    ${emailCTA(`${APP_URL}/admin`, 'View in Admin Portal')}`)
}

function signedAdminEmail(empName: string, empPos: string) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">✍️</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName}'s review is fully signed</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      Both the manager and <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) have signed the performance review. Please confirm the review cycle is complete in the admin portal.
    </p>
    ${emailCTA(`${APP_URL}/admin`, 'Confirm Completion')}`)
}

function completeEmail(empName: string, year: number) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">🎉</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">Your ${year} review is complete!</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      Hi ${empName}, your annual performance review cycle for ${year} has been completed and confirmed by your admin. Thank you for your participation.
    </p>
    ${emailCTA(`${APP_URL}/employee`, 'View Your Review')}`)
}

function managerCompleteEmail(empName: string, empPos: string, year: number) {
  return emailWrapper(`
    <div style="font-size:24px;margin-bottom:14px;">✅</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f0f2fa;">${empName}'s ${year} review cycle is complete</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">
      The ${year} annual performance review for <strong style="color:#f0f2fa;">${empName}</strong> (${empPos}) has been confirmed as complete.
    </p>
    ${emailCTA(`${APP_URL}/performance-review`, 'View Manager Portal')}`)
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date()

  async function sendEmail(to: string, subject: string, html: string) {
    try {
      const { sendEmail: send } = await import('@/lib/email')
      await send({ to, subject, html })
    } catch { /* non-fatal */ }
  }

  async function notify(userId: string, type: string, title: string, body: string, refId: string) {
    await svc.from('notifications').insert({ user_id: userId, type, title, body, reference_id: refId })
  }

  // Fetch active employees with start dates
  const { data: employees } = await svc
    .from('profiles')
    .select('id, name, email, manager_id, position, start_date')
    .eq('role', 'employee')
    .eq('is_active', true)
    .not('start_date', 'is', null)

  // Fetch admins once
  const { data: adminsRaw } = await svc
    .from('profiles')
    .select('id, email')
    .in('role', ['admin'])
    .eq('is_active', true)

  const adminList = (adminsRaw ?? []) as { id: string; email: string }[]

  let created = 0
  let advanced = 0

  for (const emp of (employees ?? []) as {
    id: string; name: string | null; email: string; manager_id: string | null; position: string | null; start_date: string
  }[]) {
    const startDate = new Date(emp.start_date + 'T00:00:00')
    const empName = emp.name || emp.email
    const empPos = emp.position || 'Employee'

    // Find the soonest upcoming anniversary (this year or next) within 35 days
    let targetAnn: Date | null = null
    let annYear = 0

    for (const yr of [now.getFullYear(), now.getFullYear() + 1]) {
      const candidate = new Date(yr, startDate.getMonth(), startDate.getDate())
      const daysAway = Math.ceil((candidate.getTime() - now.getTime()) / 86400000)
      if (daysAway >= -7 && daysAway <= 35) {
        targetAnn = candidate
        annYear = yr
        break
      }
    }

    if (!targetAnn) continue

    // One cycle per employee per anniversary year. Scoping the lookup to this
    // year means a manually triggered cycle for this year is found and reused
    // (never duplicated), while a cycle from a prior year — even an unfinished
    // one — does not block this year's cycle from being created.
    const { data: existing } = await svc
      .from('employee_review_cycles')
      .select('*')
      .eq('employee_id', emp.id)
      .eq('anniversary_year', annYear)
      .maybeSingle()

    type CycleRow = {
      id: string; employee_id: string; anniversary_year: number; phase: string
      sa_open_at: string; sa_close_at: string; review_open_at: string; review_close_at: string
      meeting_open_at: string; meeting_close_at: string
      sa_submitted_at: string | null; review_exported_at: string | null
      manager_signed_at: string | null; employee_signed_at: string | null
      admin_confirmed_at: string | null; confirmed_by: string | null
      notif_sa_open_sent_at: string | null; notif_sa_submitted_sent_at: string | null
      notif_review_open_sent_at: string | null; notif_review_exported_sent_at: string | null
      notif_meeting_sent_at: string | null; notif_signed_sent_at: string | null
      notif_complete_sent_at: string | null
      notif_sa_halfway_sent_at: string | null; notif_sa_3day_sent_at: string | null; notif_sa_1day_sent_at: string | null
      notif_review_halfway_sent_at: string | null; notif_review_3day_sent_at: string | null; notif_review_1day_sent_at: string | null
      notif_meeting_3day_sent_at: string | null; notif_meeting_1day_sent_at: string | null
    }

    let cycle: CycleRow | null = existing as CycleRow | null

    const daysToAnn = Math.ceil((targetAnn.getTime() - now.getTime()) / 86400000)

    if (!cycle && daysToAnn >= 0 && daysToAnn <= 31) {
      // Build date windows anchored at anniversary - 30 days
      const saOpen = new Date(targetAnn); saOpen.setDate(saOpen.getDate() - 30)
      const saClose = new Date(saOpen); saClose.setDate(saClose.getDate() + 7)
      const revOpen = new Date(saClose)
      const revClose = new Date(revOpen); revClose.setDate(revClose.getDate() + 14)
      const meetOpen = new Date(revClose)
      const meetClose = new Date(meetOpen); meetClose.setDate(meetClose.getDate() + 7)

      const { data: newCycle } = await svc
        .from('employee_review_cycles')
        .insert({
          employee_id: emp.id,
          anniversary_year: annYear,
          phase: 'pending',
          trigger_date: targetAnn.toISOString().split('T')[0],
          sa_open_at: saOpen.toISOString(),
          sa_close_at: saClose.toISOString(),
          review_open_at: revOpen.toISOString(),
          review_close_at: revClose.toISOString(),
          meeting_open_at: meetOpen.toISOString(),
          meeting_close_at: meetClose.toISOString(),
        })
        .select()
        .single()

      cycle = newCycle as CycleRow | null
      if (cycle) created++
    }

    if (!cycle || cycle.phase === 'complete') continue

    const cycleYear = cycle.anniversary_year

    // Get manager
    let manager: { id: string; name: string | null; email: string } | null = null
    if (emp.manager_id) {
      const { data: mgr } = await svc.from('profiles').select('id, name, email').eq('id', emp.manager_id).single()
      manager = mgr as typeof manager
    }
    const mgrName = manager?.name || manager?.email || 'their manager'

    // Collect event data from related tables
    const updates: Record<string, unknown> = {}

    if (!cycle.sa_submitted_at) {
      const { data: sa } = await svc
        .from('self_reviews')
        .select('submitted_at')
        .eq('employee_id', emp.id)
        .eq('status', 'submitted')
        .gte('submitted_at', cycle.sa_open_at)
        .maybeSingle()
      if (sa?.submitted_at) updates.sa_submitted_at = sa.submitted_at
    }

    if (!cycle.review_exported_at) {
      const { data: rev } = await svc
        .from('reviews')
        .select('updated_at')
        .eq('employee_id', emp.id)
        .not('drive_url', 'is', null)
        .gte('updated_at', cycle.review_open_at)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (rev?.updated_at) updates.review_exported_at = rev.updated_at
    }

    if (!cycle.manager_signed_at || !cycle.employee_signed_at) {
      const { data: rev } = await svc
        .from('reviews')
        .select('manager_signed_at, employee_signed_at')
        .eq('employee_id', emp.id)
        .not('manager_signed_at', 'is', null)
        .not('employee_signed_at', 'is', null)
        .gte('manager_signed_at', cycle.review_open_at)
        .maybeSingle()
      if (rev) {
        if (!cycle.manager_signed_at) updates.manager_signed_at = rev.manager_signed_at
        if (!cycle.employee_signed_at) updates.employee_signed_at = rev.employee_signed_at
      }
    }

    // Snapshot with pending updates applied
    const c = { ...cycle, ...updates }
    const nowMs = now.getTime()

    function fmtD(iso: string) {
      return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    // ── Phase transitions ─────────────────────────────────────────────────────

    // pending → sa_open
    if (c.phase === 'pending' && nowMs >= new Date(c.sa_open_at).getTime()) {
      updates.phase = 'sa_open'; advanced++
      if (!c.notif_sa_open_sent_at) {
        updates.notif_sa_open_sent_at = now.toISOString()
        const due = fmtD(c.sa_close_at)
        await notify(emp.id, 'sa_open', 'Your self-assessment is open', `Complete your self-assessment by ${due}.`, cycle.id)
        if (manager) await notify(manager.id, 'sa_open', `${empName}'s self-assessment period has started`, `They have until ${due} to complete it.`, cycle.id)
        await sendEmail(emp.email, `Your ${cycleYear} Self-Assessment is now open`, saOpenEmail(empName, due))
        if (manager?.email) await sendEmail(manager.email, `${empName}'s self-assessment period is now open`, managerSAOpenEmail(empName, empPos, due))
      }
    }

    // SA submitted notification
    if (c.sa_submitted_at && !c.notif_sa_submitted_sent_at) {
      updates.notif_sa_submitted_sent_at = now.toISOString()
      if (manager) {
        await notify(manager.id, 'sa_submitted', `${empName} submitted their self-assessment`, 'View it in your manager portal.', cycle.id)
        await sendEmail(manager.email, `${empName} submitted their self-assessment`, saSubmittedEmail(empName, empPos))
      }
      for (const admin of adminList) {
        await notify(admin.id, 'sa_submitted', `${empName} submitted their self-assessment`, `Submitted ${new Date(c.sa_submitted_at).toLocaleDateString()}.`, cycle.id)
      }
    }

    // sa_open / pending → review_open (time-based)
    if ((c.phase === 'sa_open' || c.phase === 'pending') && nowMs >= new Date(c.review_open_at).getTime()) {
      updates.phase = 'review_open'; advanced++
      if (!c.notif_review_open_sent_at) {
        updates.notif_review_open_sent_at = now.toISOString()
        const due = fmtD(c.review_close_at)
        if (manager) {
          await notify(manager.id, 'review_open', `${empName}'s performance review is now open`, `Complete the review by ${due}.`, cycle.id)
          await sendEmail(manager.email, `${empName}'s performance review is now open`, reviewOpenEmail(empName, empPos, due))
        }
        for (const admin of adminList) {
          await notify(admin.id, 'review_open', `${empName}'s review period opened`, `${mgrName} has until ${due}.`, cycle.id)
          await sendEmail(admin.email, `${empName}'s review period has opened`, reviewOpenAdminEmail(empName, empPos, mgrName, due))
        }
      }
    }

    // Review exported notification
    if (c.review_exported_at && !c.notif_review_exported_sent_at) {
      updates.notif_review_exported_sent_at = now.toISOString()
      for (const admin of adminList) {
        await notify(admin.id, 'review_exported', `${empName}'s review has been exported`, `${mgrName} exported the review to Drive.`, cycle.id)
      }
    }

    // review_open → meeting (time-based)
    if (c.phase === 'review_open' && nowMs >= new Date(c.meeting_open_at).getTime()) {
      updates.phase = 'meeting'; advanced++
      if (!c.notif_meeting_sent_at) {
        updates.notif_meeting_sent_at = now.toISOString()
        const due = fmtD(c.meeting_close_at)
        if (manager) {
          await notify(manager.id, 'meeting', `Schedule your 1-on-1 with ${empName}`, `Meeting + signing window closes ${due}.`, cycle.id)
          await sendEmail(manager.email, `Schedule your 1-on-1 with ${empName}`, meetingEmail(empName, empPos, due))
        }
        for (const admin of adminList) {
          await notify(admin.id, 'meeting', `${empName}'s 1-on-1 meeting window is open`, `${mgrName} has until ${due}.`, cycle.id)
          await sendEmail(admin.email, `${empName}'s meeting window is open`, meetingAdminEmail(empName, empPos, mgrName, due))
        }
      }
    }

    // meeting → signed (both signatures present)
    if ((c.phase === 'meeting' || c.phase === 'review_open') && c.manager_signed_at && c.employee_signed_at && !c.notif_signed_sent_at) {
      updates.phase = 'signed'; advanced++
      updates.notif_signed_sent_at = now.toISOString()
      for (const admin of adminList) {
        await notify(admin.id, 'signed', `${empName}'s review is fully signed`, 'Both parties have signed. Please confirm completion.', cycle.id)
        await sendEmail(admin.email, `${empName}'s review is ready for your confirmation`, signedAdminEmail(empName, empPos))
      }
    }

    // signed → complete (admin_confirmed_at set, notification not yet sent)
    if (c.phase === 'signed' && c.admin_confirmed_at && !c.notif_complete_sent_at) {
      updates.phase = 'complete'; advanced++
      updates.notif_complete_sent_at = now.toISOString()
      await notify(emp.id, 'complete', `Your ${cycleYear} review is complete`, 'Your annual performance review cycle has been confirmed.', cycle.id)
      if (manager) await notify(manager.id, 'complete', `${empName}'s ${cycleYear} review is complete`, `The cycle has been confirmed by admin.`, cycle.id)
      await sendEmail(emp.email, `Your ${cycleYear} performance review is complete`, completeEmail(empName, cycleYear))
      if (manager?.email) await sendEmail(manager.email, `${empName}'s ${cycleYear} review is complete`, managerCompleteEmail(empName, empPos, cycleYear))
    }

    // ── Deadline reminders ────────────────────────────────────────────────────

    function daysUntil(iso: string) {
      return Math.ceil((new Date(iso).getTime() - nowMs) / 86400000)
    }

    function halfwayPassed(openIso: string, closeIso: string) {
      const open = new Date(openIso).getTime()
      const close = new Date(closeIso).getTime()
      const half = open + (close - open) / 2
      return nowMs >= half
    }

    // SA reminders (only while in sa_open phase and not yet submitted)
    const effectivePhase = (updates.phase as string | undefined) ?? c.phase
    if ((effectivePhase === 'sa_open' || c.phase === 'sa_open') && !c.sa_submitted_at) {
      const dLeft = daysUntil(c.sa_close_at)
      const due = fmtD(c.sa_close_at)

      // Halfway reminder
      if (!c.notif_sa_halfway_sent_at && halfwayPassed(c.sa_open_at, c.sa_close_at) && dLeft > 3) {
        updates.notif_sa_halfway_sent_at = now.toISOString()
        await notify(emp.id, 'sa_reminder', 'Self-assessment reminder', `You're halfway through your self-assessment window. Due ${due}.`, cycle.id)
        await sendEmail(emp.email, `Reminder: Your self-assessment is due ${due}`, saReminderEmail(empName, due, dLeft))
      }

      // 3-day reminder
      if (!c.notif_sa_3day_sent_at && dLeft <= 3 && dLeft > 1) {
        updates.notif_sa_3day_sent_at = now.toISOString()
        await notify(emp.id, 'sa_reminder', `Self-assessment due in ${dLeft} days`, `Please complete your self-assessment by ${due}.`, cycle.id)
        await sendEmail(emp.email, `Reminder: Self-assessment due in ${dLeft} days`, saReminderEmail(empName, due, dLeft))
        if (manager?.email) await sendEmail(manager.email, `${empName}'s self-assessment due in ${dLeft} days`, saReminderEmail(empName, due, dLeft))
      }

      // 1-day reminder
      if (!c.notif_sa_1day_sent_at && dLeft <= 1 && dLeft >= 0) {
        updates.notif_sa_1day_sent_at = now.toISOString()
        await notify(emp.id, 'sa_reminder', 'Self-assessment due tomorrow!', `Last chance — due ${due}.`, cycle.id)
        await sendEmail(emp.email, `Final reminder: Self-assessment due tomorrow`, saReminderEmail(empName, due, 1))
        if (manager?.email) await sendEmail(manager.email, `Final reminder: ${empName}'s self-assessment due tomorrow`, saReminderEmail(empName, due, 1))
      }
    }

    // Review reminders (only while in review_open phase)
    if (effectivePhase === 'review_open' || c.phase === 'review_open') {
      const dLeft = daysUntil(c.review_close_at)
      const due = fmtD(c.review_close_at)

      // Halfway reminder
      if (!c.notif_review_halfway_sent_at && halfwayPassed(c.review_open_at, c.review_close_at) && dLeft > 3) {
        updates.notif_review_halfway_sent_at = now.toISOString()
        if (manager) {
          await notify(manager.id, 'review_reminder', `${empName}'s review reminder`, `Halfway through the review window. Due ${due}.`, cycle.id)
          await sendEmail(manager.email, `Reminder: ${empName}'s performance review due ${due}`, reviewReminderEmail(empName, empPos, due, dLeft))
        }
        for (const admin of adminList) {
          await sendEmail(admin.email, `Halfway reminder: ${empName}'s review due ${due}`, reviewReminderAdminEmail(empName, empPos, mgrName, due, dLeft))
        }
      }

      // 3-day reminder
      if (!c.notif_review_3day_sent_at && dLeft <= 3 && dLeft > 1) {
        updates.notif_review_3day_sent_at = now.toISOString()
        if (manager) {
          await notify(manager.id, 'review_reminder', `${empName}'s review due in ${dLeft} days`, `Complete and export the review by ${due}.`, cycle.id)
          await sendEmail(manager.email, `Reminder: ${empName}'s review due in ${dLeft} days`, reviewReminderEmail(empName, empPos, due, dLeft))
        }
        for (const admin of adminList) {
          await sendEmail(admin.email, `${empName}'s review due in ${dLeft} days`, reviewReminderAdminEmail(empName, empPos, mgrName, due, dLeft))
        }
      }

      // 1-day reminder
      if (!c.notif_review_1day_sent_at && dLeft <= 1 && dLeft >= 0) {
        updates.notif_review_1day_sent_at = now.toISOString()
        if (manager) {
          await notify(manager.id, 'review_reminder', `Final: ${empName}'s review due tomorrow!`, `Last chance to complete and export the review.`, cycle.id)
          await sendEmail(manager.email, `Final reminder: ${empName}'s review due tomorrow`, reviewReminderEmail(empName, empPos, due, 1))
        }
        for (const admin of adminList) {
          await sendEmail(admin.email, `Final reminder: ${empName}'s review due tomorrow`, reviewReminderAdminEmail(empName, empPos, mgrName, due, 1))
        }
      }
    }

    // Meeting reminders (only while in meeting phase)
    if (effectivePhase === 'meeting' || c.phase === 'meeting') {
      const dLeft = daysUntil(c.meeting_close_at)
      const due = fmtD(c.meeting_close_at)

      // 3-day reminder
      if (!c.notif_meeting_3day_sent_at && dLeft <= 3 && dLeft > 1) {
        updates.notif_meeting_3day_sent_at = now.toISOString()
        if (manager) {
          await notify(manager.id, 'meeting_reminder', `${empName}'s meeting due in ${dLeft} days`, `Schedule the 1-on-1 and collect signatures by ${due}.`, cycle.id)
          await sendEmail(manager.email, `Reminder: Schedule 1-on-1 with ${empName} — ${dLeft} days left`, meetingReminderEmail(empName, empPos, due, dLeft))
        }
      }

      // 1-day reminder
      if (!c.notif_meeting_1day_sent_at && dLeft <= 1 && dLeft >= 0) {
        updates.notif_meeting_1day_sent_at = now.toISOString()
        if (manager) {
          await notify(manager.id, 'meeting_reminder', `Final: ${empName}'s meeting window closes tomorrow!`, `Last chance to hold the meeting and sign off.`, cycle.id)
          await sendEmail(manager.email, `Final reminder: 1-on-1 with ${empName} due tomorrow`, meetingReminderEmail(empName, empPos, due, 1))
        }
        for (const admin of adminList) {
          await sendEmail(admin.email, `Final reminder: ${empName}'s meeting window closes tomorrow`, meetingReminderEmail(empName, empPos, due, 1))
        }
      }
    }

    // Persist updates
    if (Object.keys(updates).length > 0) {
      await svc
        .from('employee_review_cycles')
        .update({ ...updates, updated_at: now.toISOString() })
        .eq('id', cycle.id)
    }
  }

  return NextResponse.json({ ok: true, created, advanced, timestamp: now.toISOString() })
}
