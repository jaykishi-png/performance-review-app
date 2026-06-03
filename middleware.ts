import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Role } from '@/lib/permissions'

const PUBLIC_PATHS = ['/login', '/api/auth/callback', '/api/auth/signout', '/forbidden']

const ROUTE_FAMILY_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/admin', roles: ['admin', 'dev_admin'] },
  { prefix: '/dev', roles: ['dev_admin'] },
  { prefix: '/manager', roles: ['manager'] },
  { prefix: '/employee', roles: ['employee'] },
  { prefix: '/performance-review', roles: ['manager', 'admin', 'dev_admin'] },
]

export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  const path = request.nextUrl.pathname

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Optimistic route-family guard using cookie set at login
    const roleCookie = request.cookies.get('user_role')?.value as Role | undefined

    if (roleCookie) {
      const family = ROUTE_FAMILY_ROLES.find(f => path.startsWith(f.prefix))
      if (family && !family.roles.includes(roleCookie)) {
        const url = request.nextUrl.clone()
        url.pathname = '/forbidden'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch {
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
