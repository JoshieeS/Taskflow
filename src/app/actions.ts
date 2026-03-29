// src/app/actions.ts
//
// Server actions for push subscription management.
// Digest notifications (morning/evening) are now handled by
// the Supabase Edge Function `send-digest`, triggered via pg_cron.
'use server'

import { createClient } from '@supabase/supabase-js'

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
