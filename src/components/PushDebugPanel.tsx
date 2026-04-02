// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2B: Push debug panel
// File: src/components/PushDebugPanel.tsx — NEW FILE
// Add this temporarily inside the config tab to diagnose issues
// Remove once notifications are confirmed working
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useState } from 'react'

interface PushDebugPanelProps {
  userId: string | null
}

export default function PushDebugPanel({ userId }: PushDebugPanelProps) {
  const [log,     setLog]     = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addLog = (msg: string) => {
    console.log('[PushDebug]', msg)
    setLog(prev => [...prev, msg])
  }

  const runDiagnostics = async () => {
    setLog([])
    setLoading(true)

    // Check 1: Service worker
    addLog(`1. serviceWorker in navigator: ${'serviceWorker' in navigator}`)
    addLog(`2. PushManager in window: ${'PushManager' in window}`)
    addLog(`3. Notification.permission: ${Notification.permission}`)

    // Check 2: Subscription
    try {
      const reg = await navigator.serviceWorker.ready
      addLog(`4. service worker state: ${reg.active?.state ?? 'none'}`)
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        addLog(`5. subscription exists: YES`)
        addLog(`   endpoint: ${sub.endpoint.slice(0, 60)}...`)
        addLog(`   p256dh: ${sub.getKey('p256dh') ? 'available' : 'not available'}`)
      } else {
        addLog(`5. subscription exists: NO — user needs to enable notifications`)
      }
    } catch (err: any) {
      addLog(`4. service worker error: ${err.message}`)
    }

    // Check 3: Supabase row
    addLog(`6. userId: ${userId ?? 'NULL — not logged in'}`)

    // Check 4: Force send
    if (userId) {
      addLog(`7. sending test push to server...`)
      try {
        const res  = await fetch('/api/test-push', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ userId }),
        })
        const data = await res.json()
        addLog(`8. server response: ${JSON.stringify(data)}`)

        if (!data.ok && data.reason?.includes('no subscriptions')) {
          addLog(`   → PROBLEM: no rows in push_subscriptions for this user`)
          addLog(`   → FIX: click the push alerts toggle to subscribe first`)
        } else if (data.ok) {
          addLog(`   → SUCCESS: check your phone for the notification`)
        }
      } catch (err: any) {
        addLog(`8. fetch error: ${err.message}`)
      }
    } else {
      addLog(`7. skipping test push — no userId`)
    }

    setLoading(false)
  }

  const subscribeNow = async () => {
    setLog([])
    setLoading(true)

    try {
      addLog('subscribing to push...')
      const reg = await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      addLog(`permission: ${permission}`)
      if (permission !== 'granted') {
        addLog('BLOCKED: enable notifications in browser settings')
        setLoading(false)
        return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      addLog(`vapid key present: ${!!vapidKey}`)

      if (!vapidKey) {
        addLog('ERROR: NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
        setLoading(false)
        return
      }

      // Convert VAPID key
      const padding  = '='.repeat((4 - vapidKey.length % 4) % 4)
      const base64   = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData  = window.atob(base64)
      const keyArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; i++) keyArray[i] = rawData.charCodeAt(i)

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:   true,
        applicationServerKey: keyArray,
      })
      addLog(`subscription created: ${sub.endpoint.slice(0, 60)}...`)

      // Save to Supabase via actions
      const serialized = JSON.parse(JSON.stringify(sub))
      addLog(`saving to server... userId: ${userId}`)

      const res = await fetch('/api/save-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sub: serialized, userId }),
      })
      const data = await res.json()
      addLog(`save result: ${JSON.stringify(data)}`)

    } catch (err: any) {
      addLog(`ERROR: ${err.message}`)
    }

    setLoading(false)
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <div className="section-label">push debug</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            background: 'var(--text)', color: 'var(--bg)',
            border: 'none', borderRadius: 3, padding: '7px 12px',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? '...' : 'run diagnostics'}
        </button>
        <button
          onClick={subscribeNow}
          disabled={loading}
          style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            background: 'transparent', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 3, padding: '7px 12px',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          force subscribe
        </button>
      </div>

      {log.length > 0 && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 4, padding: 12, lineHeight: 1.8,
          maxHeight: 240, overflowY: 'auto',
        }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}