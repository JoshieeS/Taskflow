// THEORY: Per-user notification scheduling
//
// Vercel cron jobs run on a fixed schedule — you can't create one cron
// per user. The solution is to run the cron frequently (every 30 min)
// and have the API route check which users' preferred time falls within
// the current 30-minute window.
//
// User stores: { morning_time: "07:30", evening_time: "21:00", timezone: "Asia/Qatar" }
// Cron fires: every 30 minutes
// API checks: convert now() to each user's timezone, see if it matches their time
//
// THEORY: Timezone handling
//
// We store the user's IANA timezone string (e.g. "Asia/Qatar") not a UTC offset.
// UTC offsets change with daylight saving — IANA names don't.
// The browser gives us the timezone via Intl.DateTimeFormat().resolvedOptions().timeZone
// We store it once on first save and allow the user to change it.

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'

interface NotifPrefs {
  morning_time : string   // "HH:MM" in user's local time
  evening_time : string   // "HH:MM" in user's local time
  timezone     : string   // IANA timezone e.g. "Asia/Qatar"
  morning_on   : boolean
  evening_on   : boolean
}

const DEFAULTS: NotifPrefs = {
  morning_time: '07:30',
  evening_time: '21:00',
  timezone:     'Asia/Qatar',
  morning_on:   true,
  evening_on:   false,
}

interface NotificationSettingsProps {
  userId          : string
  notifStatus     : 'idle' | 'subscribed' | 'denied' | 'unsupported'
  onToggleNotifs  : () => void
}

export default function NotificationSettings({
  userId, notifStatus, onToggleNotifs
}: NotificationSettingsProps) {
  const supabase = createBrowserClient()
  const [prefs,   setPrefs]   = useState<NotifPrefs>(DEFAULTS)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing preferences on mount
  useEffect(() => {
    if (!userId) return
    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            morning_time: data.morning_time ?? DEFAULTS.morning_time,
            evening_time: data.evening_time ?? DEFAULTS.evening_time,
            timezone:     data.timezone     ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            morning_on:   data.morning_on   ?? DEFAULTS.morning_on,
            evening_on:   data.evening_on   ?? DEFAULTS.evening_on,
          })
        } else {
          // No prefs yet — use browser timezone as default
          setPrefs(p => ({
            ...p,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }))
        }
        setLoading(false)
      })
  }, [userId])

  const save = async () => {
    setSaving(true)
    setSaved(false)

    await supabase
      .from('user_preferences')
      .upsert({
        user_id:      userId,
        morning_time: prefs.morning_time,
        evening_time: prefs.evening_time, 
        timezone:     prefs.timezone,
        morning_on:   prefs.morning_on,
        evening_on:   prefs.evening_on,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <>
      <div className="section-label" style={{ marginTop: 20 }}>notifications</div>

      {/* Push alerts toggle */}
      <div
        className="setting-row"
        style={{ cursor: 'pointer' }}
        onClick={onToggleNotifs}
      >
        <span className="setting-key">// push alerts</span>
        <span className="setting-val">
          {notifStatus === 'subscribed'  ? 'on →'        :
           notifStatus === 'unsupported' ? 'unsupported' :
           notifStatus === 'denied'      ? 'blocked'     : 'off →'}
        </span>
      </div>

      {notifStatus === 'denied' && (
        <div style={{
          fontFamily:   'var(--mono)',
          fontSize:      11,
          color:        'var(--muted)',
          paddingBottom: 12,
        }}>
          // enable in browser settings to receive digests
        </div>
      )}

      {/* Morning digest */}
      <div className="setting-row">
        <span className="setting-key">
          <span
            style={{ cursor: 'pointer', opacity: prefs.morning_on ? 1 : 0.45 }}
            onClick={() => setPrefs(p => ({ ...p, morning_on: !p.morning_on }))}
          >
            // morning digest {prefs.morning_on ? '○' : '—'}
          </span>
        </span>
        <input
          type="time"
          value={prefs.morning_time}
          onChange={e => setPrefs(p => ({ ...p, morning_time: e.target.value }))}
          disabled={!prefs.morning_on}
          style={{
            fontFamily:  'var(--mono)',
            fontSize:     11,
            color:       prefs.morning_on ? 'var(--text)' : 'var(--faint)',
            background:  'transparent',
            border:      'none',
            outline:     'none',
            cursor:      prefs.morning_on ? 'auto' : 'default',
            padding:      0,
            width:        60,
            textAlign:   'right',
          }}
        />
      </div>

      {/* Evening review */}
      <div className="setting-row">
        <span className="setting-key">
          <span
            style={{ cursor: 'pointer', opacity: prefs.evening_on ? 1 : 0.45 }}
            onClick={() => setPrefs(p => ({ ...p, evening_on: !p.evening_on }))}
          >
            // evening review {prefs.evening_on ? '○' : '—'}
          </span>
        </span>
        <input
          type="time"
          value={prefs.evening_time}
          onChange={e => setPrefs(p => ({ ...p, evening_time: e.target.value }))}
          disabled={!prefs.evening_on}
          style={{
            fontFamily:  'var(--mono)',
            fontSize:     11,
            color:       prefs.evening_on ? 'var(--text)' : 'var(--faint)',
            background:  'transparent',
            border:      'none',
            outline:     'none',
            cursor:      prefs.evening_on ? 'auto' : 'default',
            padding:      0,
            width:        60,
            textAlign:   'right',
          }}
        />
      </div>

      {/* Timezone */}
      <div className="setting-row">
        <span className="setting-key">// timezone</span>
        <span
          className="setting-val"
          style={{ fontSize: 10, maxWidth: 160, textAlign: 'right', wordBreak: 'break-all' }}
        >
          {prefs.timezone}
        </span>
      </div>

      {/* Save button */}
      <div style={{ padding: '12px 0 4px' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            fontFamily:   'var(--mono)',
            fontSize:      11,
            background:    saved ? 'transparent' : 'var(--text)',
            color:         saved ? 'var(--muted)' : 'var(--bg)',
            border:       `1px solid ${saved ? 'var(--border)' : 'var(--text)'}`,
            borderRadius:  3,
            padding:      '8px 16px',
            cursor:        saving ? 'default' : 'pointer',
            opacity:       saving ? 0.6 : 1,
            letterSpacing: '0.04em',
            transition:   'all 0.2s',
          }}
        >
          {saving ? '...' : saved ? '// saved' : '// save times'}
        </button>
      </div>
    </>
  )
}