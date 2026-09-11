import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * The employee's own next scheduled review meeting.
 *
 * /api/reviews withholds an employee's review until meeting_confirmed_at is set,
 * so it cannot carry this: by the time it returns anything, the meeting has
 * already happened. This endpoint returns scheduling metadata ONLY — when and
 * where — and never review content, so the pre-meeting gate stays intact.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('reviews')
      .select('id, meeting_scheduled_at, meeting_location')
      .eq('employee_id', user.id)
      .is('meeting_confirmed_at', null)
      .not('meeting_scheduled_at', 'is', null)
      .order('meeting_scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ meeting: data ?? null })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
