import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { FALLBACK_COMPETENCIES } from '@/lib/competencies'

export const dynamic = 'force-dynamic'

// The migration has not been run yet. Postgres reports 42P01 ("relation does
// not exist"); PostgREST reports PGRST205 when the table is absent from its
// schema cache, which is what Supabase surfaces through the JS client.
const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

function isMissingTable(code?: string) {
  return !!code && MISSING_TABLE_CODES.includes(code)
}

async function requireAdmin(userId: string) {
  const svc = createServiceClient()
  const { data } = await svc.from('profiles').select('role').eq('id', userId).single()
  const role = (data as { role: string } | null)?.role
  return role === 'admin' || role === 'dev_admin'
}

// ---------------------------------------------------------------------------
// GET — the competency list, for any authenticated user.
//
// Both the employee self-assessment and the manager performance review populate
// their dropdowns from here. `?all=true` (admin) also returns inactive rows.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const includeInactive = req.nextUrl.searchParams.get('all') === 'true'
  const svc = createServiceClient()

  let query = svc
    .from('competencies')
    .select('id, name, definition, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    // Before the migration runs there is no table. Serve the built-in list so
    // the dropdowns keep working rather than rendering empty.
    if (isMissingTable(error.code)) {
      return NextResponse.json({
        competencies: FALLBACK_COMPETENCIES.map((c, i) => ({
          id: `fallback-${i}`, ...c, sort_order: i * 10, is_active: true,
        })),
        source: 'fallback',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ competencies: data ?? [], source: 'db' })
}

// ---------------------------------------------------------------------------
// POST — add a competency (admin)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await requireAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { name?: string; definition?: string }
  const name = (body.name ?? '').trim()
  const definition = (body.definition ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const svc = createServiceClient()

  // Append to the end of the list.
  const { data: last } = await svc
    .from('competencies')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 10

  const { data, error } = await svc
    .from('competencies')
    .insert({ name, definition, sort_order: sortOrder })
    .select()
    .single()

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json(
        { error: 'The competencies table does not exist yet. Run supabase/add-competencies.sql first.' },
        { status: 503 }
      )
    }
    // 23505 = unique_violation on name
    if (error.code === '23505') {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ competency: data })
}

// ---------------------------------------------------------------------------
// PATCH — edit a competency, or toggle it active/inactive (admin)
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await requireAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    id?: string; name?: string; definition?: string; is_active?: boolean; sort_order?: number
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    update.name = name
  }
  if (body.definition !== undefined) update.definition = body.definition.trim()
  if (body.is_active !== undefined) update.is_active = body.is_active
  if (body.sort_order !== undefined) update.sort_order = body.sort_order

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('competencies')
    .update(update)
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Another competency already has that name' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ competency: data })
}

// ---------------------------------------------------------------------------
// DELETE — remove a competency (admin)
//
// Reviews store the competency name as text, so this only changes what is
// selectable going forward; existing reviews keep what they recorded.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await requireAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc.from('competencies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
