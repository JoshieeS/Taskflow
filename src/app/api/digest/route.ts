// src/app/api/digest/route.ts
import { sendMorningDigest } from '@/app/actions'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()

  // Fetch every user who has at least one push subscription
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('user_id')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Deduplicate — a user can have multiple devices
  const uniqueUserIds = [...new Set(subs?.map(s => s.user_id) ?? [])]

  // Send digest to each user sequentially
  for (const userId of uniqueUserIds) {
    await sendMorningDigest(userId)
  }

  return Response.json({
    ok: true,
    sent: uniqueUserIds.length,
    time: new Date().toISOString(),
  })
}