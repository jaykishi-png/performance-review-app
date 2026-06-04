import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'not authenticated', authError })

    const serviceClient = createServiceClient()

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, name, email, role, manager_id')
      .eq('id', user.id)
      .single()

    let manager = null
    let managerError = null
    if (profile?.manager_id) {
      const res = await serviceClient
        .from('profiles')
        .select('name, email')
        .eq('id', profile.manager_id)
        .single()
      manager = res.data
      managerError = res.error
    }

    return NextResponse.json({
      userId: user.id,
      userEmail: user.email,
      profile,
      profileError,
      manager,
      managerError,
      serviceRoleKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15),
    })
  } catch (e) {
    return NextResponse.json({ exception: String(e) })
  }
}
