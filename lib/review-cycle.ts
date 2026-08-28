/**
 * Shared anniversary-year math for review cycles.
 *
 * A review cycle is identified by (employee_id, anniversary_year). Both the
 * scheduled cron and the manual admin trigger must agree on which year is
 * current, otherwise the same annual period can be created twice under two
 * different year labels.
 */

/** The calendar year of the employee's anniversary for the period `now` falls in. */
function currentAnniversaryYear(startDate: string, now: Date): number {
  const sd = new Date(startDate + 'T00:00:00')
  const thisYearAnn = new Date(now.getFullYear(), sd.getMonth(), sd.getDate())
  // Before this year's anniversary, we're still inside the prior year's period.
  return thisYearAnn <= now ? now.getFullYear() : now.getFullYear() - 1
}

/**
 * The anniversary year a cycle should be opened for, given that cycles open
 * ahead of the anniversary itself. Within `leadDays` of the next anniversary we
 * are opening that upcoming year's cycle, not the current period's.
 */
export function cycleAnniversaryYear(startDate: string, now: Date, leadDays = 35): number {
  const sd = new Date(startDate + 'T00:00:00')
  for (const yr of [now.getFullYear(), now.getFullYear() + 1]) {
    const candidate = new Date(yr, sd.getMonth(), sd.getDate())
    const daysAway = Math.ceil((candidate.getTime() - now.getTime()) / 86400000)
    if (daysAway >= 0 && daysAway <= leadDays) return yr
  }
  return currentAnniversaryYear(startDate, now)
}
