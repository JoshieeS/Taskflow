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
import NotificationSettings from '@/components/NotificationSettings'
import AuthScreen from '@/components/AuthScreen'
import ExportSheet from '@/components/ExportSheet'
import BugReport from '@/components/BugReport'
import ThemePicker from '@/components/ThemePicker'
import CalendarView from '@/components/CalenderView'
import AISummary from '@/components/AiSummary'
import SharedCart from '@/components/SharedCart'
import LoadingScreen from '@/components/LoadingScreen'

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
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [notifStatus, setNotifStatus] = useState<NotifStatus>('idle')
  const [userName, setUserName] = useState<string>('')
  const [showBugReport, setShowBugReport] = useState(false)
  const [tab, setTab] = useState<TabId>('pending')
  const [filter, setFilter] = useState<'today' | 'all'>('today')
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)
  const [showExport, setShowExport] = useState(false)
  const { tasks, loading, addTask, updateTask, deleteTask, isOnline } = useTasks(userId)
  const appReady = authReady && (!userId || !loading)


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error?.message?.includes('Refresh Token Not Found') ||
        error?.message?.includes('Invalid Refresh Token')) {
        supabase.auth.signOut()
        setUserId(null)
        setAuthReady(true)
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

  function toISO(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // ── Computed values ────────────────────────────────────────────────────
  const todayISO = toISO(new Date())

  const todayTasks = tasks.filter(t => {
    if (t.due === 'someday') return false
    if (t.due === 'today') return true  // legacy
    if (t.due === todayISO) return true
    // overdue: any past ISO date
    if (t.due.match(/^\d{4}-\d{2}-\d{2}$/) && t.due < todayISO) return true
    return false
  })

  const pendingToday = todayTasks.filter(t => !t.done)
  const doneToday = todayTasks.filter(t => t.done)
  const progress = todayTasks.length
    ? Math.round((doneToday.length / todayTasks.length) * 100)
    : 0

  // Source pool for pending/done tabs
  const pool = filter === 'today' ? todayTasks : tasks

  // All tasks sorted: done first, then pending, each group sorted by due date
  const sortByDue = (a: Task, b: Task) => {
    const resolve = (due: string) => {
      if (due === 'someday') return '9999-12-31'
      if (due === 'today') return todayISO   // legacy
      return due
    }
    return resolve(a.due).localeCompare(resolve(b.due))
  }

  const displayed =
    tab === 'pending'
      ? [...pool.filter(t => !t.done)].sort(sortByDue)
      : tab === 'done'
        ? [...pool.filter(t => t.done)].sort(sortByDue)
        : [
          // all tab: done first, then pending, each sorted by due date
          ...[...tasks.filter(t => t.done)].sort(sortByDue),
          ...[...tasks.filter(t => !t.done)].sort(sortByDue),
        ]

  // ── Push Notifications ──────────────────────────────────────────────────────      
  const handleNotificationToggle = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported')
      return
    }

    const registration = await navigator.serviceWorker.ready

    if (notifStatus === 'subscribed') {
      // Unsubscribe
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        if (userId) {
          await fetch('/api/save-subscription', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint, userId }),
          })
        }
      }
      setNotifStatus('idle')
      return
    }

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission === 'denied') {
      setNotifStatus('denied')
      return
    }
    if (permission !== 'granted') return

    // Convert VAPID key to Uint8Array
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    const padding = '='.repeat((4 - vapidKey.length % 4) % 4)
    const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const keyArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++) keyArray[i] = rawData.charCodeAt(i)

    // Subscribe
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray,
    })

    // Save via Route Handler (not Server Action)
    const serialized = JSON.parse(JSON.stringify(sub))
    const res = await fetch('/api/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub: serialized, userId }),
    })
    const result = await res.json()
    console.log('[notifications] save result:', result)

    if (result.ok) {
      setNotifStatus('subscribed')
    } else {
      console.error('[notifications] save failed:', result.reason)
    }
  }

  return (
    <>
      <LoadingScreen ready={appReady} />
      {authReady && !userId && <AuthScreen />}
      {authReady && userId && (
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

            {(tab === 'pending' || tab === 'done') && (
              <div className="body scrollbar"
                style={{
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: '0%',
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '0 24px 80px',
                }}>
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

            {tab === 'cart' && (
              <SharedCart userId={userId} />
            )}

            {tab === 'calendar' && (
              <CalendarView
                tasks={tasks}
                onClick={task => setDetail(task)}
              />
            )}

            {tab === 'stats' && (
              <div className="body scrollbar">
                <div className="body" style={{ paddingBottom: '10px' }}>
                  <AISummary tasks={todayTasks} scope='today' />
                </div>
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
              <div className="body scrollbar">
                <div className="section-label">account</div>
                <div className="setting-row">
                  <span className="setting-key">// logged in as</span>
                  <span className="setting-val">you</span>
                </div>
                <div className="setting-row" style={{ cursor: 'pointer' }} onClick={() => setShowExport(true)}>
                  <span className="setting-key">// export tasks</span>
                  <span className="setting-val">→</span>
                </div>
                <div className="setting-row" style={{ cursor: 'pointer' }} onClick={() => setShowBugReport(true)}>
                  <span className="setting-key">// report a bug or have suggestions?</span>
                  <span className="setting-val">→</span>
                </div>
                <ThemePicker userId={userId} />
                <div className="setting-row" style={{ cursor: 'pointer', marginTop: 20 }}
                  onClick={() => supabase.auth.signOut()}>
                  <span className="setting-key">// sign out</span>
                  <span className="setting-val">→</span>
                </div>

                <NotificationSettings
                  userId={userId}
                  notifStatus={notifStatus}
                  onToggleNotifs={handleNotificationToggle}
                />
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

          {showExport && (
            <ExportSheet
              tasks={tasks}
              onClose={() => setShowExport(false)}
            />
          )}

          {showBugReport && (
            <BugReport onClose={() => setShowBugReport(false)} userId={userId} />
          )}


        </div>
      )}
    </>
  )
}