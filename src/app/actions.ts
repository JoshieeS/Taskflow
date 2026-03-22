// src/app/actions.ts
'use server'

import webpush from 'web-push'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// This runs once when the module loads on the server.
// It configures the web-push library with your identity and keys.
webpush.setVapidDetails(
  'mailto:joshuaarindha@gmail.com',         
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// ── SUBSCRIBE ────────────────────────────────────────────────────────────────
// Called when a user grants notification permission in the browser.
// Receives the PushSubscription object from the browser and stores it.

type SerializedSubscription = {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export async function subscribeUser(sub: SerializedSubscription, userId: string) {
  const supabase = await createServerSupabaseClient()
  if (!userId) throw new Error('Not authenticated')

  // Keys are already plain base64 strings — no getKey() or ArrayBuffer needed
  await supabase.from('push_subscriptions').upsert({
    user_id:  userId,
    endpoint: sub.endpoint,
    p256dh:   sub.keys.p256dh,
    auth_key: sub.keys.auth,
  }, { onConflict: 'endpoint' })

  return { success: true }
}

// ── UNSUBSCRIBE ───────────────────────────────────────────────────────────────
// Called when a user turns off notifications in your settings tab.

export async function unsubscribeUser(endpoint: string, userId: string) {
  const supabase = await createServerSupabaseClient()
  if (!userId) throw new Error('Not authenticated')

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  return { success: true }
}

// ── SEND MORNING DIGEST ───────────────────────────────────────────────────────
// Called by the cron job at 7:30am GST.
// Fetches today's pending tasks and pushes a summary to all user devices.

export async function sendMorningDigest(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, priority')
    .eq('user_id', userId)
    .eq('due', 'today')
    .eq('done', false)

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  // Nothing to do if no tasks or no subscriptions
  if (!tasks?.length || !subs?.length) return

  const count  = tasks.length
  const urgent = tasks.filter(t => t.priority === 'high').length

  const payload = JSON.stringify({
    title: `taskflow — ${count} task${count !== 1 ? 's' : ''} today`,
    body:  urgent > 0 ? `${urgent} urgent` : 'have a productive day',
    icon:  '/icon-192x192.png',
    url:   '/',
  })

  // Send to every registered device for this user in parallel
  await Promise.all(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      ).catch(err => {
        // A 410 Gone response means the subscription is no longer valid —
        // the user uninstalled the app or revoked permission at the OS level.
        // We delete the dead subscription so it doesn't clog the table.
        if (err.statusCode === 410) {
          supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      })
    )
  )
}