'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useTasks } from '@/hooks/useTasks'
import Nav from '@/components/Nav'
import Header from '@/components/Header'
import TaskRow from '@/components/TaskRow'
import AddSheet from '@/components/AddSheet'
import DetailSheet from '@/components/DetailSheet'
import type { Task, TabId } from '@/types'
import { subscribeUser, unsubscribeUser } from '@/app/actions'
import AuthScreen from '@/components/AuthScreen'

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning'] as const

type NotifStatus = 'idle' | 'subscribed' | 'denied' | 'unsupported'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function HomePage() {
  const supabase = createBrowserClient()


  // Auth state — null = not checked yet, object = logged in, false = logged out
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [notifStatus, setNotifStatus] = useState<NotifStatus>('idle')
  const [userName, setUserName] = useState<string>('')
  // UI state
  const [tab, setTab] = useState<TabId>('today')
  const [filter, setFilter] = useState<'pending' | 'done'>('pending')
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)

  // Real-time tasks from our custom hook
  const { tasks, loading, addTask, updateTask, deleteTask, isOnline } = useTasks(userId)
  console.log(showAdd)

  // ── Get User Details ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error?.message?.includes('Refresh Token Not Found') ||
        error?.message?.includes('Invalid Refresh Token')) {
        supabase.auth.signOut()
        setUserId(null)
        setAuthReady(true)
        return
      }

      setUserId(session?.user.id ?? null)
      const meta = session?.user?.user_metadata
      setUserName(meta?.name ?? meta?.full_name ?? meta?.email ?? '')
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null)
        const meta = session?.user?.user_metadata
        setUserName(meta?.name ?? meta?.full_name ?? meta?.email ?? '')
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Notification Check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported')
      return
    }

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setNotifStatus(sub ? 'subscribed' : 'idle')
      })
    })
  }, [])


  // ── Computed values ────────────────────────────────────────────────────
  const todayISO = new Date().toISOString().split('T')[0]  // '2026-03-22'

  const todayTasks = tasks.filter(t => {
    if (t.due === 'today') return true
    // Include specific dates that are today or in the past (overdue)
    if (t.due !== 'this week' && t.due !== 'someday') {
      return t.due <= todayISO
    }
    return false
  })
  const pendingToday = todayTasks.filter(t => !t.done)
  const doneToday = todayTasks.filter(t => t.done)
  const progress = todayTasks.length
    ? Math.round((doneToday.length / todayTasks.length) * 100)
    : 0

  const displayed =
    tab === 'today' ? (filter === 'pending' ? pendingToday : doneToday) :
      tab === 'all' ? tasks :
        tasks.filter(t => t.done)

  // ── Push Notifications ──────────────────────────────────────────────────────      
  const handleNotificationToggle = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported')
      return
    }

    const registration = await navigator.serviceWorker.ready

    if (notifStatus === 'subscribed') {
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        if (!userId) return
        await unsubscribeUser(sub.endpoint, userId)  // ← add userId
      }
      setNotifStatus('idle')
      return
    }

    // Request permission — this shows the browser's native prompt
    const permission = await Notification.requestPermission()
    if (permission === 'denied') {
      setNotifStatus('denied')
      return
    }

    // Subscribe
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    })

    // Send subscription to server for storage
    if (!userId) return
    await subscribeUser(JSON.parse(JSON.stringify(sub)), userId)
    setNotifStatus('subscribed')
  }

  // ── Not ready yet ──────────────────────────────────────────────────────
  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
      loading...
    </div>
  )

  // ── Login screen ───────────────────────────────────────────────────────
  if (!userId) return <AuthScreen />

  // ── Main app ───────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <Nav activeTab={tab} onTabChange={setTab} />

      <main className="main">
        {!isOnline && (
          <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 24px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em', }}>
            // offline — changes will sync when reconnected
          </div>
        )}
        <Header
          tab={tab}
          filter={filter}
          onFilterChange={setFilter}
          pendingCount={pendingToday.length}
          doneCount={doneToday.length}
          urgentCount={tasks.filter(t => t.priority === 'high' && !t.done).length}
          progress={progress}
          userName={userName}
        />

        {(tab === 'today' || tab === 'all') && (
          <div className="body">
            {loading ? (
              <div className="empty">loading...</div>
            ) : displayed.length === 0 ? (
              <div className="empty">— nothing here —</div>
            ) : (
              displayed.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  delay={i * 0.04}
                  onToggle={() => updateTask(task.id, { done: !task.done })}
                  onClick={() => setDetail(task)}
                />
              ))
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div className="body">
            <div className="section-label">by category</div>
            <div className="stat-block">
              {CATEGORIES.map(cat => {
                const all = tasks.filter(t => t.category === cat)
                const done = all.filter(t => t.done).length
                const pct = all.length ? Math.round((done / all.length) * 100) : 0
                return (
                  <div key={cat} className="stat-row">
                    <span className="stat-cat">{cat}</span>
                    <div className="stat-bar-wrap"><div className="stat-bar" style={{ width: `${pct}%` }} /></div>
                    <span className="stat-fraction">{done}/{all.length}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'config' && (
          <div className="body">
            <div className="section-label">account</div>
            <div className="setting-row">
              <span className="setting-key">// logged in as</span>
              <span className="setting-val">you</span>
            </div>
            <div className="setting-row" style={{ cursor: 'pointer' }}
              onClick={() => supabase.auth.signOut()}>
              <span className="setting-key">// sign out</span>
              <span className="setting-val">→</span>
            </div>
            <div className="section-label" style={{ marginTop: 20 }}>notifications</div>
            <div className="setting-row">
              <span className="setting-key">// morning digest</span>
              <span className="setting-val">07:30 GST</span>
            </div>
            <div
              className="setting-row"
              style={{ cursor: 'pointer' }}
              onClick={handleNotificationToggle}
            >
              <span className="setting-key">// push alerts</span>
              <span className="setting-val">
                {notifStatus === 'subscribed' ? 'on →' :
                  notifStatus === 'unsupported' ? 'unsupported' :
                    notifStatus === 'denied' ? 'blocked' : 'off →'}
              </span>
            </div>
            {notifStatus === 'denied' && (
              <div style={{ fontSize: 11, color: 'var(--muted)', paddingBottom: 12, fontFamily: 'var(--mono)' }}>
        // enable in browser settings to receive digests
              </div>
            )}
            <div className="section-label" style={{ marginTop: 20 }}>sync</div>
            <div className="setting-row">
              <span className="setting-key">// provider</span>
              <span className="setting-val">supabase</span>
            </div>
            <div className="setting-row">
              <span className="setting-key">// realtime</span>
              <span className="setting-val">enabled</span>
            </div>
          </div>
        )}
      </main>

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add task">+</button>

      {showAdd && (
        <AddSheet onClose={() => setShowAdd(false)} onAdd={addTask} />
      )}

      {detail && (
        <DetailSheet
          task={detail}
          tasks={tasks}
          onClose={() => setDetail(null)}
          onToggle={(id) => updateTask(id, { done: !detail.done })}
          onDelete={deleteTask}
          onUpdate={updateTask}
        />
      )}
    </div>
  )
}