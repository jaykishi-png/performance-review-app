import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Apply invite role if one exists for this user's email
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const serviceClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll: () => [], setAll: () => {} } }
      )
      const { data: invite } = await serviceClient
        .from('invites')
        .select('role, id, manager_id')
        .eq('email', user.email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (invite) {
        const inv = invite as { role: string; id: string; manager_id: string | null }
        // Apply role and manager from invite
        await serviceClient
          .from('profiles')
          .update({
            role: inv.role,
            ...(inv.manager_id ? { manager_id: inv.manager_id } : {}),
          })
          .eq('id', user.id)
        await serviceClient
          .from('invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', inv.id)
      }
    }
  } catch { /* invite check is best-effort */ }

  // Always redirect to / — app/page.tsx handles role-based routing via service key
  return NextResponse.redirect(`${origin}/`)
}
