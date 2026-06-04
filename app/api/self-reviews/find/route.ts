import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/self-reviews/find?name=Shannon+Cruz
// Manager looks up a direct report's submitted self-review by name
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const name = req.nextUrl.searchParams.get('name')?.trim()
    if (!name) return NextResponse.json({ text: null })

    const serviceClient = createServiceClient()

    // Verify caller is a manager or admin
    const { data: callerProfile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (callerProfile as { role: string } | null)?.role
    if (role !== 'manager' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find employee by name (case-insensitive partial match)
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, manager_id')
      .ilike('name', `%${name}%`)
      .eq('role', 'employee')

    if (!profiles || profiles.length === 0) return NextResponse.json({ text: null })

    // For managers, filter to only their direct reports
    const candidates = role === 'admin'
      ? profiles
      : profiles.filter(p => (p as { manager_id: string }).manager_id === user.id)

    if (candidates.length === 0) return NextResponse.json({ text: null })

    // Get submitted self-review for the first match
    const { data: sr } = await serviceClient
      .from('self_reviews')
      .select('strengths, growth_areas, goal_reflections, overall_rating, overall_comments, status')
      .eq('employee_id', (candidates[0] as { id: string }).id)
      .eq('status', 'submitted')
      .single()

    if (!sr) return NextResponse.json({ text: null })

    const s = sr as {
      strengths: string; growth_areas: string;
      goal_reflections: { goal: string; reflection: string }[];
      overall_rating: number | null; overall_comments: string
    }

    // Format the self-review as readable text for the AI comparison
    const RATINGS: Record<number, string> = {
      1: 'Needs Improvement', 2: 'Below Expectations', 3: 'Meets Expectations',
      4: 'Exceeds Expectations', 5: 'Outstanding',
    }

    const goalText = (s.goal_reflections ?? [])
      .filter(g => g.goal?.trim())
      .map((g, i) => `Goal ${i + 1}: ${g.goal}\n${g.reflection}`)
      .join('\n\n')

    const text = [
      `EMPLOYEE SELF-REVIEW`,
      `====================`,
      ``,
      `STRENGTHS`,
      s.strengths,
      ``,
      `AREAS FOR GROWTH`,
      s.growth_areas,
      goalText ? `\nGOAL REFLECTIONS\n${goalText}` : '',
      ``,
      `OVERALL SELF-RATING: ${s.overall_rating ? `${s.overall_rating}/5 — ${RATINGS[s.overall_rating]}` : 'Not rated'}`,
      s.overall_comments ? `\nADDITIONAL COMMENTS\n${s.overall_comments}` : '',
    ].filter(l => l !== undefined).join('\n')

    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
