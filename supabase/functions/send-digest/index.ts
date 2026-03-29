// supabase/functions/send-digest/index.ts
import webpush from 'web-push'

const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic  = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidEmail   = Deno.env.get('VAPID_EMAIL')!

webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)

function toLocalHHMM(date: Date, timezone: string): string {
  try {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      hour12: false, timeZone: timezone,
    })
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

function isInCurrentWindow(prefTime: string, nowInUserTz: string): boolean {
  const [pH, pM] = prefTime.split(':').map(Number)
  const [nH, nM] = nowInUserTz.split(':').map(Number)
  const prefMins = pH * 60 + pM
  const nowMins  = nH * 60 + nM
  const windowStart = Math.floor(nowMins / 30) * 30
  return prefMins >= windowStart && prefMins < windowStart + 30
}

async function supabaseFetch(path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey':        serviceKey,
    },
  })
  return res.json()
}

Deno.serve(async (req: Request) => {
  // Manual auth check — verify the caller passes the service role key
  // (verify_jwt is disabled because the new sb_secret_ key format isn't JWT)
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()

  const subs  = await supabaseFetch('push_subscriptions?select=user_id')
  const prefs = await supabaseFetch('user_preferences?select=*')
  const prefsMap = new Map(prefs.map((p: any) => [p.user_id, p]))

  const uniqueIds = [...new Set((subs as any[]).map(s => s.user_id))]
  const todayISO  = now.toISOString().split('T')[0]

  let sent = 0

  for (const userId of uniqueIds) {
    const pref = prefsMap.get(userId) as any
    const timezone    = pref?.timezone     ?? 'Asia/Qatar'
    const morningTime = pref?.morning_time ?? '07:30'
    const eveningTime = pref?.evening_time ?? '21:00'
    const morningOn   = pref?.morning_on   ?? true
    const eveningOn   = pref?.evening_on   ?? false

    const userTime = toLocalHHMM(now, timezone)

    let title = '', body = ''

    if (morningOn && isInCurrentWindow(morningTime, userTime)) {
      const tasks = await supabaseFetch(
        `tasks?user_id=eq.${userId}&done=eq.false&select=priority,due`
      ) as any[]
      const todayTasks = tasks.filter(t =>
        t.due === 'today' || t.due === todayISO ||
        (t.due.match(/^\d{4}-\d{2}-\d{2}$/) && t.due < todayISO)
      )
      if (!todayTasks.length) continue
      const urgent = todayTasks.filter(t => t.priority === 'high').length
      title = `taskflow — ${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} today`
      body  = urgent > 0 ? `${urgent} urgent · good morning` : 'good morning'

    } else if (eveningOn && isInCurrentWindow(eveningTime, userTime)) {
      const done    = await supabaseFetch(`tasks?user_id=eq.${userId}&done=eq.true&due=eq.${todayISO}&select=id`) as any[]
      const pending = await supabaseFetch(`tasks?user_id=eq.${userId}&done=eq.false&due=eq.${todayISO}&select=id`) as any[]
      title = 'taskflow — end of day'
      body  = done.length > 0 && !pending.length
        ? `all ${done.length} done · great work`
        : `${done.length} done · ${pending.length} remaining`

    } else {
      continue
    }

    // Fetch subscriptions for this user
    const userSubs = await supabaseFetch(
      `push_subscriptions?user_id=eq.${userId}&select=endpoint,p256dh,auth_key`
    ) as any[]

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title, body, icon: '/icon-192x192.png', url: '/' })
        )
        sent++
      } catch (err: any) {
        if (err.statusCode === 410) {
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
          })
        }
      }
    }
  }

  return Response.json({ ok: true, sent, utcTime: now.toISOString() })
})