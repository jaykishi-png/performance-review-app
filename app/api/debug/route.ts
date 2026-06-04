import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ authenticated: false, authError: authError?.message })
    }

    // Query with anon/authed client (RLS applies)
    const { data: anonProfile, error: anonError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    // Query with service client (bypasses RLS)
    let svcProfile = null
    let svcError = null
    try {
      const serviceClient = createServiceClient()
      const { data, error } = await serviceClient
        .from('profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .single()
      svcProfile = data
      svcError = error?.message
    } catch (e) {
      svcError = String(e)
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email,
      anonProfile,
      anonError: anonError?.message ?? null,
      svcProfile,
      svcError,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
