// src/app/actions.ts
'use server'

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// This runs once when the module loads on the server.
// It configures the web-push library with your identity and keys.
webpush.setVapidDetails(
  'mailto:joshuaarindha@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

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
  const supabase = getServiceClient()
  if (!userId) throw new Error('Not authenticated')

  // Keys are already plain base64 strings — no getKey() or ArrayBuffer needed
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth_key: sub.keys.auth,
  }, { onConflict: 'endpoint' })

  return { success: true }
}

// ── UNSUBSCRIBE ───────────────────────────────────────────────────────────────
// Called when a user turns off notifications in your settings tab.

export async function unsubscribeUser(endpoint: string, userId: string) {
  const supabase = getServiceClient()
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

async function pushToUser(userId: string, payload: object) {
  const supabase = getServiceClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (!subs?.length) return

  const message = JSON.stringify(payload)

  await Promise.all(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        message
      ).catch(async err => {
        if (err.statusCode === 410) {
          // Subscription expired — clean it up
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      })
    )
  )
}

// ── MORNING DIGEST ──────────────────────────────────────────────────────────
export async function sendMorningDigest(userId: string) {
  const supabase = getServiceClient()

  const todayISO = new Date().toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, priority, due')
    .eq('user_id', userId)
    .eq('done', false)
    .or(`due.eq.today,due.eq.${todayISO},and(due.lt.${todayISO},due.not.eq.someday)`)

  const count = tasks?.length ?? 0
  const urgent = tasks?.filter(t => t.priority === 'high').length ?? 0

  if (count === 0) return  // nothing to report

  await pushToUser(userId, {
    title: `taskflow — ${count} task${count !== 1 ? 's' : ''} today`,
    body: urgent > 0 ? `${urgent} urgent · good morning` : 'good morning',
    icon: '/icon-192x192.png',
    url: '/',
  })
}

// ── EVENING REVIEW ──────────────────────────────────────────────────────────
export async function sendEveningDigest(userId: string) {
  const supabase = getServiceClient()

  const todayISO = new Date().toISOString().split('T')[0]

  // Tasks completed today
  const { data: doneTasks } = await supabase
    .from('tasks')
    .select('title')
    .eq('user_id', userId)
    .eq('done', true)
    .or(`due.eq.today,due.eq.${todayISO}`)

  // Tasks still pending today
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('title')
    .eq('user_id', userId)
    .eq('done', false)
    .or(`due.eq.today,due.eq.${todayISO}`)

  const done = doneTasks?.length ?? 0
  const pending = pendingTasks?.length ?? 0

  const body = done === 0 && pending === 0
    ? 'nothing scheduled today'
    : done > 0 && pending === 0
      ? `all ${done} task${done !== 1 ? 's' : ''} done · great work`
      : `${done} done · ${pending} remaining`

  await pushToUser(userId, {
    title: 'taskflow — end of day',
    body,
    icon: '/icon-192x192.png',
    url: '/',
  })
}
