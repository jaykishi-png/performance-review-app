import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — employee gets their own; manager gets a direct report's by employeeId query param
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = await createServiceClient()
    const employeeId = req.nextUrl.searchParams.get('employeeId')

    if (employeeId && employeeId !== user.id) {
      // Manager fetching a direct report's self-review — verify relationship
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('manager_id')
        .eq('id', employeeId)
        .single()

      const { data: currentProfile } = await serviceClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isAdmin = (currentProfile as { role: string } | null)?.role === 'admin'
      const isManager = (profile as { manager_id: string } | null)?.manager_id === user.id

      if (!isAdmin && !isManager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data } = await serviceClient
        .from('self_reviews')
        .select('*')
        .eq('employee_id', employeeId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      return NextResponse.json({ selfReview: data ?? null })
    }

    // Employee fetching their own
    const { data } = await serviceClient
      .from('self_reviews')
      .select('*')
      .eq('employee_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ selfReview: data ?? null })
  } catch {
    return NextResponse.json({ selfReview: null })
  }
}

// POST — create or update self-review (upsert by employee_id)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const serviceClient = await createServiceClient()

    // Get manager_id from profile
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('manager_id')
      .eq('id', user.id)
      .single()

    const { data: existing } = await serviceClient
      .from('self_reviews')
      .select('id, status')
      .eq('employee_id', user.id)
      .single()

    if (existing && (existing as { status: string }).status === 'submitted' && !body.forceUpdate) {
      return NextResponse.json({ error: 'Submitted review cannot be edited' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const payload = {
      employee_id: user.id,
      manager_id: (profile as { manager_id: string | null } | null)?.manager_id ?? null,
      // New template fields
      competencies: body.competencies ?? [],
      goals_objectives: body.goalsObjectives ?? [],
      next_year_goals: body.nextYearGoals ?? [],
      overall_rating: body.overallRating ?? null,
      // Legacy fields kept for backward compat
      strengths: body.strengths ?? '',
      growth_areas: body.growthAreas ?? '',
      goal_reflections: body.goalReflections ?? [],
      overall_comments: body.overallComments ?? '',
      status: body.status ?? 'draft',
      submitted_at: body.status === 'submitted' ? now : null,
      updated_at: now,
    }

    if (existing) {
      await serviceClient.from('self_reviews').update(payload).eq('id', (existing as { id: string }).id)
    } else {
      await serviceClient.from('self_reviews').insert(payload)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
