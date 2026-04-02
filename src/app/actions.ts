'use server'

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  `mailto:${process.env.NEXT_PUBLIC_VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SERVICE_ROLE_KEY!,
  )
}

type SerializedSubscription = {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export async function subscribeUser(sub: SerializedSubscription, userId: string) {
  console.log('[subscribeUser] called for userId:', userId)
  console.log('[subscribeUser] endpoint:', sub.endpoint.slice(0, 60) + '...')
 
  if (!userId) {
    console.error('[subscribeUser] no userId provided')
    throw new Error('Not authenticated')
  }
 
  if (!sub.keys?.p256dh || !sub.keys?.auth) {
    console.error('[subscribeUser] missing keys:', sub.keys)
    throw new Error('Invalid subscription keys')
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
    console.error('[subscribeUser] DB error:', error)
    throw new Error(error.message)
  }
 
  console.log('[subscribeUser] saved successfully:', data)
  return { success: true }
}
 
export async function unsubscribeUser(endpoint: string, userId: string) {
  if (!userId) throw new Error('Not authenticated')
 
  const supabase = getServiceClient()
 
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
 
  if (error) console.error('[unsubscribeUser]', error)
  return { success: true }
}