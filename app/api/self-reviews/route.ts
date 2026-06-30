import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — employee gets their own; manager gets a direct report's by employeeId query param
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
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

      const callerRole = (currentProfile as { role: string } | null)?.role
      const isAdmin = callerRole === 'admin' || callerRole === 'dev_admin'
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
        .maybeSingle()

      if (callerRole === 'dev_admin' && data) {
        return NextResponse.json({
          selfReview: {
            id: (data as { id: string }).id,
            employee_id: (data as { employee_id: string }).employee_id,
            status: (data as { status: string }).status,
            submitted_at: (data as { submitted_at: string | null }).submitted_at,
            updated_at: (data as { updated_at: string }).updated_at,
            overall_rating: (data as { overall_rating: number | null }).overall_rating,
            competencies: (data as { competencies: unknown[] }).competencies,
            goals_objectives: (data as { goals_objectives: unknown[] }).goals_objectives,
            next_year_goals: (data as { next_year_goals: unknown[] }).next_year_goals,
            drive_url: null,
            _contentRedacted: true,
          },
        })
      }

      return NextResponse.json({ selfReview: data ?? null })
    }

    // Employee fetching their own
    const { data } = await serviceClient
      .from('self_reviews')
      .select('*')
      .eq('employee_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

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
    const serviceClient = createServiceClient()

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
      .maybeSingle()

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

    let saveError: { code?: string; message: string } | null = null
    if (existing) {
      const { error } = await serviceClient.from('self_reviews').update(payload).eq('id', (existing as { id: string }).id)
      saveError = error
    } else {
      const { error } = await serviceClient.from('self_reviews').insert(payload)
      saveError = error
    }

    // If save failed due to missing columns (migration not applied), retry without new template columns
    if (saveError && (saveError.code === '42703' || saveError.message?.includes('column'))) {
      const { competencies: _c, goals_objectives: _g, next_year_goals: _n, ...legacyPayload } = payload as Record<string, unknown>
      void _c; void _g; void _n
      const op = existing
        ? serviceClient.from('self_reviews').update(legacyPayload).eq('id', (existing as { id: string }).id)
        : serviceClient.from('self_reviews').insert(legacyPayload)
      const { error: legacyErr } = await op
      if (legacyErr) return NextResponse.json({ error: legacyErr.message }, { status: 500 })
    } else if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH — update specific fields (e.g. drive_url added manually)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const serviceClient = createServiceClient()

    // Only allow patching safe fields — never status or content via this route
    const allowed = ['drive_url', 'drive_doc_id']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No patchable fields provided' }, { status: 400 })
    }

    const { error } = await serviceClient
      .from('self_reviews')
      .update(patch)
      .eq('employee_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
