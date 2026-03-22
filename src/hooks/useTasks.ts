'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import {
  getLocalTasks,
  setLocalTasks,
  setLocalTask,
  deleteLocalTask,
  addToPendingQueue,
  getPendingQueue,
  clearPendingOp,
} from '@/lib/Offlinestore'
import type { Task, NewTask } from '@/types'

export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const supabase = createBrowserClient()
  const syncing = useRef(false)
  // Keep a ref to tasks so mutation callbacks see current state without
  // needing tasks in their dependency arrays (avoids stale closure bugs)
  const tasksRef = useRef<Task[]>([])
  tasksRef.current = tasks

  // ── Sync queue processing ──────────────────────────────────────────────────
  const processQueue = useCallback(async () => {
    if (!userId || syncing.current) return
    syncing.current = true

    try {
      const queue = await getPendingQueue()
      if (!queue.length) return

      // Sort oldest-first so operations are replayed in the order they happened
      queue.sort((a, b) => a.timestamp - b.timestamp)

      for (const op of queue) {
        try {
          if (op.type === 'DELETE') {
            await supabase.from('tasks').delete().eq('id', op.payload.id)
            await clearPendingOp(op.id)
          }

          if (op.type === 'INSERT') {
            const { data: existing } = await supabase
              .from('tasks').select('id, updated_at').eq('id', op.payload.id).maybeSingle()

            if (!existing) {
              // Doesn't exist remotely yet — insert it
              await supabase.from('tasks').insert(op.payload)
            } else {
              // Already exists — compare timestamps
              const localTime = new Date(op.payload.updated_at!).getTime()
              const remoteTime = new Date(existing.updated_at).getTime()
              if (localTime > remoteTime) {
                await supabase.from('tasks').update(op.payload).eq('id', op.payload.id)
              }
            }
            await clearPendingOp(op.id)
          }

          if (op.type === 'UPDATE') {
            const { data: remote } = await supabase
              .from('tasks').select('updated_at').eq('id', op.payload.id).maybeSingle()

            if (!remote) {
              // Task was deleted remotely while we were offline — respect that
              setTasks(prev => prev.filter(t => t.id !== op.payload.id))
              await deleteLocalTask(op.payload.id)
            } else {
              const localTime = new Date(op.payload.updated_at!).getTime()
              const remoteTime = new Date(remote.updated_at).getTime()

              if (localTime >= remoteTime) {
                // Local is newer or equal — push our version
                await supabase.from('tasks').update(op.payload).eq('id', op.payload.id)
              } else {
                // Remote is newer — pull it and update local state
                const { data: remoteTask } = await supabase
                  .from('tasks').select('*').eq('id', op.payload.id).single()
                if (remoteTask) {
                  await setLocalTask(remoteTask as Task)
                  setTasks(prev => prev.map(t => t.id === remoteTask.id ? remoteTask as Task : t))
                }
              }
            }
            await clearPendingOp(op.id)
          }
        } catch (opErr) {
          // Don't let one failed op block the rest
          console.error('[sync] failed op:', op.id, opErr)
        }
      }
    } finally {
      syncing.current = false
    }
  }, [userId])

  // ── Online / offline listeners ─────────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); processQueue() }
    const goOffline = () => { setIsOnline(false) }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [processQueue])

  // ── Initial load + real-time subscription ─────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setTasks([])
      setLoading(false)
      return
    }

    async function initialLoad() {
      // Step 1: Show local data immediately for instant render
      const local = await getLocalTasks(userId!)
      if (local.length) {
        setTasks(local)
        setLoading(false)
      }

      // Step 2: Fetch from Supabase
      const { data: remote, error: fetchErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })

      if (fetchErr) {
        // Offline — keep showing local data
        setError(fetchErr.message)
        setLoading(false)
        return
      }

      // Step 3: Get pending queue to find genuinely offline-created tasks
      const queue = await getPendingQueue()
      const pendingInsertIds = new Set(
        queue
          .filter(op => op.type === 'INSERT')
          .map(op => op.payload.id)
      )

      // Step 4: Supabase is the source of truth when online.
      // Only add local-only tasks if they have a pending INSERT —
      // meaning they were created offline and not yet synced.
      // Any local task NOT in Supabase and NOT in the queue was deleted
      // on another device — discard it.
      const remoteMap = new Map((remote ?? []).map(t => [t.id, t]))
      const localMap = new Map(local.map(t => [t.id, t]))

      const merged: Task[] = []

      // All remote tasks — these are ground truth
      for (const remoteTask of remote ?? []) {
        const localTask = localMap.get(remoteTask.id)

        if (localTask) {
          // Both exist — check for pending UPDATE that's newer than remote
          const hasPendingUpdate = queue.some(
            op => op.type === 'UPDATE' && op.payload.id === remoteTask.id
          )
          if (hasPendingUpdate) {
            const localTime = new Date(localTask.updated_at).getTime()
            const remoteTime = new Date(remoteTask.updated_at).getTime()
            merged.push(localTime > remoteTime ? localTask : remoteTask as Task)
          } else {
            // No local pending change — trust remote
            merged.push(remoteTask as Task)
          }
        } else {
          merged.push(remoteTask as Task)
        }
      }

      // Only keep local-only tasks that have a pending INSERT
      // (created offline, not yet pushed to Supabase)
      for (const [id, localTask] of localMap) {
        if (!remoteMap.has(id) && pendingInsertIds.has(id)) {
          merged.push(localTask)
        }
        // If local-only and NOT in queue → was deleted on another device → discard
      }

      merged.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Step 5: Write the authoritative merged state back to IndexedDB
      // This clears out any stale deleted tasks from local storage
      const db = await import('@/lib/Offlinestore')
      const allLocalIds = local.map(t => t.id)
      const mergedIds = new Set(merged.map(t => t.id))

      // Delete from IndexedDB any local task that didn't make it into merged
      for (const id of allLocalIds) {
        if (!mergedIds.has(id)) {
          await db.deleteLocalTask(id)
        }
      }

      await setLocalTasks(merged)
      setTasks(merged)
      setLoading(false)

      // Step 6: Process any offline queue now that we're online
      if (navigator.onLine) processQueue()
    }

    initialLoad()

    // Real-time subscription — keeps all open sessions in sync
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const t = payload.new as Task
            setTasks(prev => {
              // Avoid duplicates if we already added it optimistically
              if (prev.find(x => x.id === t.id)) return prev
              return [t, ...prev]
            })
            await setLocalTask(t)
          }
          if (payload.eventType === 'UPDATE') {
            const t = payload.new as Task
            setTasks(prev => prev.map(x => x.id === t.id ? t : x))
            await setLocalTask(t)
          }
          if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(x => x.id !== payload.old.id))
            await deleteLocalTask(payload.old.id)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addTask = useCallback(async (newTask: NewTask) => {
    if (!userId) return

    const now = new Date().toISOString()
    const task: Task = {
      ...newTask,
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: now,
      updated_at: now,
    }

    // Optimistic
    setTasks(prev => [task, ...prev])
    await setLocalTask(task)

    if (navigator.onLine) {
      const { error } = await supabase.from('tasks').insert(task)
      if (error) console.error('[addTask]', error.message)
    } else {
      await addToPendingQueue({
        id: task.id,           // use task id so INSERT coalesces cleanly
        type: 'INSERT',
        payload: task,
        timestamp: Date.now(),
      })
    }
  }, [userId])

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const now = new Date().toISOString()
    const withTimestamp = { ...updates, updated_at: now }
    const current = tasksRef.current.find(t => t.id === id)
    if (!current) return

    const updated = { ...current, ...withTimestamp }

    // Optimistic
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
    await setLocalTask(updated)

    if (navigator.onLine) {
      const { error } = await supabase.from('tasks').update(withTimestamp).eq('id', id)
      if (error) console.error('[updateTask]', error.message)
    } else {
      // Predictable id = multiple offline updates to same task collapse into one op
      await addToPendingQueue({
        id: `update-${id}`,
        type: 'UPDATE',
        payload: updated,
        timestamp: Date.now(),
      })
    }
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    // Optimistic
    setTasks(prev => prev.filter(t => t.id !== id))
    await deleteLocalTask(id)

    if (navigator.onLine) {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) console.error('[deleteTask]', error.message)
    } else {
      await addToPendingQueue({
        id: `delete-${id}`,
        type: 'DELETE',
        payload: { id },
        timestamp: Date.now(),
      })
    }
  }, [])

  return { tasks, loading, error, isOnline, addTask, updateTask, deleteTask }
}