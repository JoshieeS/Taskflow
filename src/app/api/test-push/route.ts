import { NextRequest } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'test@test.com'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  if (!userId) {
    return Response.json({ ok: false, reason: 'userId required' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Step 1: Check subscriptions exist
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  console.log('[test-push] subscriptions found:', subs?.length ?? 0)
  console.log('[test-push] subscriptions error:', subsErr)

  if (!subs?.length) {
    return Response.json({
      ok:     false,
      reason: 'no subscriptions found for this user',
      debug:  { subsErr, userId }
    }, { status: 404 })
  }

  // Step 2: Try sending to each subscription
  const results = []
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({
          title: 'taskflow — test notification',
          body:  'push notifications are working ✓',
          icon:  '/icon-192x192.png',
          url:   '/',
        })
      )
      results.push({ endpoint: sub.endpoint.slice(0, 40) + '...', status: 'sent' })
      console.log('[test-push] sent to:', sub.endpoint.slice(0, 60))
    } catch (err: any) {
      results.push({ endpoint: sub.endpoint.slice(0, 40) + '...', status: 'failed', error: err.message, statusCode: err.statusCode })
      console.error('[test-push] failed:', err.statusCode, err.message)

      // Clean up expired subscriptions
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        console.log('[test-push] removed expired subscription')
      }
    }
  }

  return Response.json({ ok: true, results })
}