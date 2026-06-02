import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getRoleHomeRoute, type Role } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    // Anon client — used only for the code exchange (sets the session cookie)
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

    // Service client — bypasses RLS for reliable profile reads/writes
    const serviceClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check for a pending invite matching this email
        const { data: invite } = await serviceClient
          .from('invites')
          .select('role, id')
          .eq('email', user.email!)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (invite) {
          await serviceClient
            .from('profiles')
            .update({ role: (invite as {role: string, id: string}).role })
            .eq('id', user.id)

          await serviceClient
            .from('invites')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', (invite as {role: string, id: string}).id)
        }

        // Read final role with service client — always works regardless of RLS
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = ((profile as {role: string} | null)?.role ?? 'pending') as Role
        const homeRoute = getRoleHomeRoute(role)
        return NextResponse.redirect(`${origin}${homeRoute}`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
