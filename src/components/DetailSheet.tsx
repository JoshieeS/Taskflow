'use client'

import { useState, useEffect, useRef } from 'react'
import type { Task } from '@/types'
import DatePicker from '@/components/DatePicker'

const PRIORITY_DOTS: Record<string, string> = {
  high: '#c0392b', medium: '#b7791f', low: '#2d6a4f',
}

const PRIORITIES = ['high', 'medium', 'low'] as const
const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning'] as const

interface DetailSheetProps {
  task    : Task
  tasks   : Task[]
  onClose : () => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Task>) => void
}

function formatDue(due: string): string {
  if (['today', 'this week', 'someday'].includes(due)) return due
  const date = new Date(due + 'T00:00:00')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).toLowerCase()
}

export default function DetailSheet({
  task: initialTask, tasks, onClose, onToggle, onDelete, onUpdate
}: DetailSheetProps) {
  const task = tasks.find(t => t.id === initialTask.id) ?? initialTask

  const [closing, setClosing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({
    title:    task.title,
    category: task.category,
    priority: task.priority,
    due:      task.due,
    notes:    task.notes,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync form if real-time updates the task while sheet is open
  useEffect(() => {
    if (!editing) {
      setForm({
        title:    task.title,
        category: task.category,
        priority: task.priority,
        due:      task.due,
        notes:    task.notes,
      })
    }
  }, [task, editing])

  const close = () => {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(onClose, 240)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const saveEdits = () => {
    if (!form.title.trim()) return
    onUpdate(task.id, form)
    close()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Escape') {
        if (editing) setEditing(false)
        else close()
      }
      if (editing && e.key === 'Enter' && tag !== 'TEXTAREA') saveEdits()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, form, closing])

  return (
    <div
      className={`overlay${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className={`sheet${closing ? ' closing' : ''}`}>
        <div className="sheet-handle" />

        {/* ── Header row ── */}
        <div className="sheet-header">
          {editing ? (
            <button className="sheet-btn cancel" onClick={() => setEditing(false)}>cancel</button>
          ) : (
            <button className="sheet-btn cancel" onClick={close}>close</button>
          )}
          <span className="sheet-title">{editing ? 'edit task' : 'task detail'}</span>
          {editing ? (
            <button className="sheet-btn add" onClick={saveEdits}>save</button>
          ) : (
            <button className="sheet-btn add" onClick={() => setEditing(true)}>edit</button>
          )}
        </div>

        {/* ── View mode ── */}
        {!editing && (
          <>
            <div className="detail-title">{task.title}</div>
            <div className="detail-row">
              <span className="detail-key">priority</span>
              <span className="detail-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: PRIORITY_DOTS[task.priority],
                  display: 'inline-block'
                }} />
                {task.priority}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-key">category</span>
              <span className="detail-val">{task.category}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">due</span>
              <span className="detail-val">{formatDue(task.due)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">status</span>
              <span className="detail-val">{task.done ? 'complete' : 'pending'}</span>
            </div>
            {task.notes && <div className="detail-note">// {task.notes}</div>}
            <div className="detail-actions">
              <button
                className="detail-btn danger"
                onClick={() => { onDelete(task.id); close() }}
              >
                delete
              </button>
              <button
                className="detail-btn primary"
                onClick={() => { onToggle(task.id); close() }}
              >
                {task.done ? 'mark pending' : 'mark done'}
              </button>
            </div>
          </>
        )}

        {/* ── Edit mode ── */}
        {editing && (
          <>
            <div className="form-block" style={{ marginTop: 8 }}>
              <div className="form-label">title</div>
              <input
                className="form-input"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="form-block" style={{ marginTop: 18 }}>
              <div className="form-label">priority</div>
              <div className="chip-row">
                {PRIORITIES.map(k => (
                  <button
                    key={k}
                    className={`chip${form.priority === k ? ' selected' : ''}`}
                    onClick={() => setForm(p => ({ ...p, priority: k }))}
                  >{k}</button>
                ))}
              </div>
            </div>

            <div className="form-block" style={{ marginTop: 18 }}>
              <div className="form-label">category</div>
              <div className="chip-row">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    className={`chip${form.category === c ? ' selected' : ''}`}
                    onClick={() => setForm(p => ({ ...p, category: c }))}
                  >{c}</button>
                ))}
              </div>
            </div>

            <div className="form-block" style={{ marginTop: 18 }}>
              <div className="form-label">due</div>
              <DatePicker
                value={form.due}
                onChange={val => setForm(p => ({ ...p, due: val }))}
              />
            </div>

            <div className="form-block" style={{ marginTop: 18, paddingBottom: 24 }}>
              <div className="form-label">notes // optional</div>
              <textarea
                className="form-input"
                rows={3}
                placeholder="any context..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            <div className="kbd-hint" style={{ padding: '0 24px 24px' }}>
              <span className="kbd">↵</span><span>to save · </span>
              <span className="kbd">esc</span><span>to cancel</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}