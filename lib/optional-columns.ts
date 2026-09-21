/**
 * Columns that exist in the code before they exist in the database.
 *
 * A migration this project needs is applied by hand in the Supabase SQL editor,
 * so there is always a window where deployed code selects a column the database
 * does not have yet. PostgREST answers that with 42703, and a caller that
 * destructures only `data` turns the error into an empty list — the whole
 * reviews portal silently reads as "nobody has a review".
 *
 * Wrap those reads in `selectTolerant` so a missing optional column costs its
 * own feature and nothing else.
 */

/** Meeting scheduling — supabase/add-meeting-scheduled.sql */
export const MEETING_SCHEDULE_COLUMNS = 'meeting_scheduled_at, meeting_location'

export interface QueryError { code?: string | null; message?: string | null; hint?: string | null }

export function isMissingColumn(error: QueryError | null | undefined): boolean {
  if (!error) return false
  // 42703 = undefined_column
  return error.code === '42703' || /column .* does not exist/i.test(error.message ?? '')
}

/**
 * Run a select with `optional` columns appended; if the database does not have
 * them yet, run it again without them.
 *
 * `run` is called with the full column list and must build the query fresh each
 * time — a Supabase query builder cannot be re-executed.
 */
export async function selectTolerant<T>(
  base: string,
  optional: string,
  run: (columns: string) => PromiseLike<{ data: T | null; error: QueryError | null }>,
): Promise<{ data: T | null; error: QueryError | null; degraded: boolean }> {
  const full = `${base}, ${optional}`
  const first = await run(full)
  if (!isMissingColumn(first.error)) {
    return { data: first.data, error: first.error, degraded: false }
  }
  console.warn(`[optional-columns] falling back — missing: ${optional}. Run the pending migration.`)
  const second = await run(base)
  return { data: second.data, error: second.error, degraded: true }
}
