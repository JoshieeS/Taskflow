// src/app/api/digest/route.ts
//
// THEORY: Per-user time-aware digest
//
// Vercel cron fires this route every 30 minutes (see vercel.json).
// For each user who has push subscriptions, we:
//   1. Load their notification preferences (morning_time, evening_time, timezone)
//   2. Convert "now" to their local timezone
//   3. Check if their preferred time falls within the current 30-minute window
//   4. If yes, send the appropriate digest (morning or evening)
//
// Why 30-minute windows?
//   A user sets their time to 07:30. The cron fires at 07:00, 07:30, 08:00.
//   We check: is 07:30 >= 07:00 AND < 07:30? No.
//   Is 07:30 >= 07:30 AND < 08:00? Yes. Send it.
//
// This means users get their notification within 30 minutes of their chosen time.
// For exact-minute precision you'd need a queue system — overkill for a personal app.
//
// THEORY: Timezone conversion
//   Intl.DateTimeFormat with timeZone option converts UTC timestamps to
//   any IANA timezone correctly, including DST transitions.
//   We extract HH:MM in the user's local time and compare to their preference.

import { createClient } from '@supabase/supabase-js'
import { sendMorningDigest, sendEveningDigest } from '@/app/actions'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Convert a UTC Date to HH:MM in a given IANA timezone
function toLocalHHMM(date: Date, timezone: string): string {
  try {
    return date.toLocaleTimeString('en-GB', {
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
      timeZone: timezone,
    })
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.toISOString().slice(11, 16)
  }
}

// Check if a preference time HH:MM falls within the current 30-minute window
// Window: [windowStart, windowStart + 30min)
function isInCurrentWindow(prefTime: string, nowInUserTz: string): boolean {
  const [prefH,  prefM]  = prefTime.split(':').map(Number)
  const [nowH,   nowM]   = nowInUserTz.split(':').map(Number)

  const prefMinutes = prefH * 60 + prefM
  const nowMinutes  = nowH  * 60 + nowM

  // Window is [nowMinutes, nowMinutes + 30)
  // We round down now to the nearest 30-min boundary
  const windowStart = Math.floor(nowMinutes / 30) * 30
  const windowEnd   = windowStart + 30

  return prefMinutes >= windowStart && prefMinutes < windowEnd
}

export async function GET() {
  const supabase = getServiceClient()
  const now      = new Date()

  // Fetch all users with push subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id')

  if (!subs?.length) {
    return Response.json({ ok: true, checked: 0, sent: 0 })
  }

  const uniqueUserIds = [...new Set(subs.map(s => s.user_id))]

  // Fetch preferences for all these users
  const { data: allPrefs } = await supabase
    .from('user_preferences')
    .select('*')
    .in('user_id', uniqueUserIds)

  const prefsMap = new Map(allPrefs?.map(p => [p.user_id, p]) ?? [])

  let sent = 0

  for (const userId of uniqueUserIds) {
    const prefs = prefsMap.get(userId)

    // Default prefs if user hasn't configured
    const timezone    = prefs?.timezone     ?? 'Asia/Qatar'
    const morningTime = prefs?.morning_time ?? '07:30'
    const eveningTime = prefs?.evening_time ?? '21:00'
    const morningOn   = prefs?.morning_on   ?? true
    const eveningOn   = prefs?.evening_on   ?? false

    // Convert current UTC time to user's local time
    const userLocalTime = toLocalHHMM(now, timezone)

    // Check morning window
    if (morningOn && isInCurrentWindow(morningTime, userLocalTime)) {
      await sendMorningDigest(userId)
      sent++
      continue
    }

    // Check evening window
    if (eveningOn && isInCurrentWindow(eveningTime, userLocalTime)) {
      await sendEveningDigest(userId)
      sent++
    }
  }

  return Response.json({
    ok:      true,
    checked: uniqueUserIds.length,
    sent,
    utcTime: now.toISOString(),
  })
}