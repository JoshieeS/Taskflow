import type { Task } from '@/types'

const DB_NAME = 'taskflow'
const DB_VERSION = 1
const TASKS_STORE = 'tasks'
const QUEUE_STORE = 'pending_ops'

export type PendingOp =
    | {
        id: string
        type: 'INSERT'
        payload: Task         
        timestamp: number
    }
    | {
        id: string
        type: 'UPDATE'
        payload: Task          
        timestamp: number
    }
    | {
        id: string
        type: 'DELETE'
        payload: { id: string }
        timestamp: number
    }

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
    if (_db) return Promise.resolve(_db)

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result

            if (!db.objectStoreNames.contains(TASKS_STORE)) {
                const store = db.createObjectStore(TASKS_STORE, { keyPath: 'id' })
                // Index by user_id so we can filter locally without scanning all rows
                store.createIndex('user_id', 'user_id', { unique: false })
            }

            if (!db.objectStoreNames.contains(QUEUE_STORE)) {
                db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
            }
        }

        req.onsuccess = (e) => {
            _db = (e.target as IDBOpenDBRequest).result
            resolve(_db)
        }

        req.onerror = () => reject(req.error)
    })
}

// ── Tasks store ────────────────────────────────────────────────────────────────

export async function getLocalTasks(userId: string): Promise<Task[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TASKS_STORE, 'readonly')
        const index = tx.objectStore(TASKS_STORE).index('user_id')
        const req = index.getAll(userId)
        req.onsuccess = () => resolve((req.result as Task[]) || [])
        req.onerror = () => reject(req.error)
    })
}

// Write a batch of tasks (used during initial sync merge)
export async function setLocalTasks(tasks: Task[]): Promise<void> {
    if (!tasks.length) return
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TASKS_STORE, 'readwrite')
        const store = tx.objectStore(TASKS_STORE)
        tasks.forEach(t => store.put(t))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// Write or update a single task
export async function setLocalTask(task: Task): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TASKS_STORE, 'readwrite')
        tx.objectStore(TASKS_STORE).put(task)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// Remove a single task by id
export async function deleteLocalTask(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TASKS_STORE, 'readwrite')
        tx.objectStore(TASKS_STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// ── Pending ops queue ──────────────────────────────────────────────────────────

export async function addToPendingQueue(op: PendingOp): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite')
        tx.objectStore(QUEUE_STORE).put(op)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function getPendingQueue(): Promise<PendingOp[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly')
        const req = tx.objectStore(QUEUE_STORE).getAll()
        req.onsuccess = () => resolve((req.result as PendingOp[]) || [])
        req.onerror = () => reject(req.error)
    })
}

export async function clearPendingOp(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite')
        tx.objectStore(QUEUE_STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}