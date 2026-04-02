import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { sub, userId } = await req.json()

  console.log('[save-subscription] userId:', userId)
  console.log('[save-subscription] endpoint:', sub?.endpoint?.slice(0, 60))
  console.log('[save-subscription] keys present:', !!sub?.keys?.p256dh, !!sub?.keys?.auth)

  if (!userId || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    console.error('[save-subscription] missing fields')
    return Response.json(
      { ok: false, reason: 'missing userId, endpoint, or keys' },
      { status: 400 }
    )
  }

  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id:  userId,
      endpoint: sub.endpoint,
      p256dh:   sub.keys.p256dh,
      auth_key: sub.keys.auth,
    }, { onConflict: 'endpoint' })
    .select()

  if (error) {
    console.error('[save-subscription] DB error:', error)
    return Response.json({ ok: false, reason: error.message }, { status: 500 })
  }

  console.log('[save-subscription] saved:', data)
  return Response.json({ ok: true, saved: data })
}

export async function DELETE(req: NextRequest) {
  const { endpoint, userId } = await req.json()

  if (!userId || !endpoint) {
    return Response.json({ ok: false, reason: 'missing fields' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) {
    console.error('[delete-subscription]', error)
    return Response.json({ ok: false, reason: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}