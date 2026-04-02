'use client'

import { useState, useEffect, useRef } from 'react'
import type { Task, SubTask } from '@/types'
import DatePicker, { resolveQuickOption } from '@/components/DatePicker'
import { enhanceTaskInBackground } from '@/lib/aiTaskEnhancer'
import TaskTimer from './TaskTimer'

const PRIORITY_DOTS: Record<string, string> = {
  high: '#c0392b', medium: '#b7791f', low: '#2d6a4f',
}
const PRIORITIES = ['high', 'medium', 'low'] as const
const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning'] as const

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function formatDue(due: string): string {
  if (due === 'someday') return 'someday'
  const todayISO = new Date().toISOString().split('T')[0]
  if (due === 'today' || due === todayISO) return 'due today'
  const date = new Date(due + 'T00:00:00')
  if (isNaN(date.getTime())) return due
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).toLowerCase()
}

// ── AI badge ─────────────────────────────────────────────────────────────────
function AiBadge({ small = false }: { small?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--mono)',
      fontSize: small ? 9 : 10,
      color: 'var(--muted)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      padding: small ? '1px 4px' : '2px 5px',
      letterSpacing: '0.04em',
      flexShrink: 0,
    }}>
      ai
    </span>
  )
}

interface DetailSheetProps {
  task: Task
  tasks: Task[]
  onClose: () => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Task>) => void
}

export default function DetailSheet({
  task: initialTask, tasks, onClose, onToggle, onDelete, onUpdate
}: DetailSheetProps) {
  const task = tasks.find(t => t.id === initialTask.id) ?? initialTask
  const subtasks = task.subtasks ?? []

  const [closing, setClosing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    category: task.category,
    priority: task.priority,
    due: task.due,
    notes: task.notes,
  })
  // Subtask editing state
  const [editingSubtasks, setEditingSubtasks] = useState(false)
  const [localSubtasks, setLocalSubtasks] = useState<SubTask[]>(subtasks)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local subtasks in sync with real-time updates
  useEffect(() => {
    if (!editingSubtasks) {
      setLocalSubtasks(task.subtasks ?? [])
    }
  }, [task.subtasks, editingSubtasks])

  useEffect(() => {
    if (!editing) {
      setForm({
        title: task.title,
        category: task.category,
        priority: task.priority,
        due: task.due,
        notes: task.notes,
      })
    }
  }, [task, editing])

  const close = () => {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(onClose, 240)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const saveEdits = () => {
    if (!form.title.trim()) return
    onUpdate(task.id, { ...form, due: resolveQuickOption(form.due) })
    close()
  }

  // ── Subtask operations ────────────────────────────────────────────────────

  const toggleSubtask = (id: string) => {
    const updated = localSubtasks.map(s =>
      s.id === id ? { ...s, done: !s.done } : s
    )
    setLocalSubtasks(updated)
    onUpdate(task.id, { subtasks: updated })
  }

  const addManualSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    const newSub: SubTask = {
      id: generateId(),
      title: newSubtaskTitle.trim(),
      done: false,
      ai_generated: false,
      created_at: new Date().toISOString(),
    }
    const updated = [...localSubtasks, newSub]
    setLocalSubtasks(updated)
    onUpdate(task.id, { subtasks: updated })
    setNewSubtaskTitle('')
  }

  const deleteSubtask = (id: string) => {
    const updated = localSubtasks.filter(s => s.id !== id)
    setLocalSubtasks(updated)
    onUpdate(task.id, { subtasks: updated })
  }

  const removeAiSubtasks = () => {
    const updated = localSubtasks.filter(s => !s.ai_generated)
    setLocalSubtasks(updated)
    onUpdate(task.id, {
      subtasks: updated,
      ai_enhanced: false,
    })
  }

  const regenerateAiSubtasks = async () => {
    setRegenerating(true)
    await enhanceTaskInBackground(task.id, task.title, localSubtasks)
    setRegenerating(false)
  }

  const saveSubtasks = () => {
    onUpdate(task.id, { subtasks: localSubtasks })
    setEditingSubtasks(false)
  }

  const aiSubtasks = localSubtasks.filter(s => s.ai_generated)
  const manualSubtasks = localSubtasks.filter(s => !s.ai_generated)
  const hasAiSubtasks = aiSubtasks.length > 0

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Escape') {
        if (editingSubtasks) { setEditingSubtasks(false); return }
        if (editing) { setEditing(false); return }
        close()
      }
      if (editing && e.key === 'Enter' && tag !== 'TEXTAREA') saveEdits()
      if (editingSubtasks && e.key === 'Enter' && tag === 'INPUT') addManualSubtask()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, editingSubtasks, form, newSubtaskTitle])

  return (
    <div
      className={`overlay${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className={`sheet${closing ? ' closing' : ''}`}>
        <div className="sheet-handle" />

        {/* ── Header ── */}
        <div className="sheet-header">
          {editing ? (
            <button className="sheet-btn cancel" onClick={() => setEditing(false)}>cancel</button>
          ) : (
            <button className="sheet-btn cancel" onClick={close}>close</button>
          )}
          <span className="sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editing ? 'edit task' : 'task detail'}
            {task.ai_enhanced && !editing && <AiBadge />}
          </span>
          {editing ? (
            <button className="sheet-btn add" onClick={saveEdits}>save</button>
          ) : (
            <button className="sheet-btn add" onClick={() => setEditing(true)}>edit</button>
          )}
        </div>

        {/* ── VIEW MODE ── */}
        {!editing && (
          <>
            <div className="detail-title">{task.title}</div>

            <div className="detail-row">
              <span className="detail-key">priority</span>
              <span className="detail-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: PRIORITY_DOTS[task.priority], display: 'inline-block' }} />
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
            <TaskTimer
              taskId={task.id}
              timeSpentSeconds={task.time_spent_seconds ?? 0}
              onSave={(additionalSeconds) => {
                const newTotal = Math.max(0, (task.time_spent_seconds ?? 0) + additionalSeconds);
                onUpdate(task.id, { time_spent_seconds: newTotal });
              }}
            />
            {task.notes && <div className="detail-note">// {task.notes}</div>}

            {/* ── SUBTASKS SECTION ── */}
            <div style={{ padding: '16px 24px 0' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--faint)',
                  letterSpacing: '0.12em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  subtasks
                  {localSubtasks.length > 0 && (
                    <span style={{ color: 'var(--muted)' }}>
                      ({localSubtasks.filter(s => s.done).length}/{localSubtasks.length})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Undo AI button — only shown if AI subtasks exist */}
                  {hasAiSubtasks && (
                    <button
                      onClick={removeAiSubtasks}
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        color: '#c0392b',
                        background: 'none',
                        border: '1px solid #f0c0bc',
                        borderRadius: 3,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                      }}
                    >
                      undo ai
                    </button>
                  )}
                  {/* Re-run AI button */}
                  <button
                    onClick={regenerateAiSubtasks}
                    disabled={regenerating}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--muted)',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '2px 8px',
                      cursor: regenerating ? 'default' : 'pointer',
                      opacity: regenerating ? 0.5 : 1,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {regenerating ? '...' : '↻ ai'}
                  </button>
                  <button
                    onClick={() => setEditingSubtasks(s => !s)}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--muted)',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {editingSubtasks ? 'done' : 'edit'}
                  </button>
                </div>
              </div>

              {/* Subtask list */}
              {localSubtasks.length === 0 && !editingSubtasks ? (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--faint)',
                  letterSpacing: '0.04em',
                  paddingBottom: 4,
                }}>
                  // no subtasks yet — ai will add some shortly
                </div>
              ) : (
                <div>
                  {/* Manual subtasks first */}
                  {manualSubtasks.map(sub => (
                    <SubtaskRow
                      key={sub.id}
                      sub={sub}
                      onToggle={() => toggleSubtask(sub.id)}
                      onDelete={editingSubtasks ? () => deleteSubtask(sub.id) : undefined}
                    />
                  ))}
                  {/* AI subtasks with a separator if both exist */}
                  {aiSubtasks.length > 0 && manualSubtasks.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 0',
                    }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <AiBadge small />
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                  {aiSubtasks.map(sub => (
                    <SubtaskRow
                      key={sub.id}
                      sub={sub}
                      onToggle={() => toggleSubtask(sub.id)}
                      onDelete={editingSubtasks ? () => deleteSubtask(sub.id) : undefined}
                      showAiBadge
                    />
                  ))}
                </div>
              )}

              {/* Add new subtask input — only in editing mode */}
              {editingSubtasks && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    style={{ marginBottom: 0, flex: 1 }}
                    placeholder="add subtask..."
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={addManualSubtask}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      border: 'none',
                      borderRadius: 3,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      letterSpacing: '0.04em',
                    }}
                  >
                    add
                  </button>
                </div>
              )}
            </div>

            <div className="detail-actions">
              <button className="detail-btn danger" onClick={() => { onDelete(task.id); close() }}>
                delete
              </button>
              <button className="detail-btn primary" onClick={() => { onToggle(task.id); close() }}>
                {task.done ? 'mark pending' : 'mark done'}
              </button>
            </div>
          </>
        )}

        {/* ── EDIT MODE ── */}
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
            <div className="form-block" style={{ marginTop: 18 }}>
              <div className="form-label">subtasks // optional</div>

              {/* Existing subtasks */}
              {localSubtasks.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {localSubtasks.map(s => (
                    <div key={s.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 0',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--text)',
                        flex: 1,
                      }}>
                        {s.title}
                      </span>
                      <button
                        onClick={() => deleteSubtask(s.id)}
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          color: 'var(--muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0 2px',
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new subtask */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ marginBottom: 0 }}
                  placeholder="add a subtask..."
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()  // prevent parent Enter from submitting form
                      addManualSubtask()
                    }
                  }}
                />
                <button
                  onClick={addManualSubtask}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >+ add</button>
              </div>
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

// ── Subtask row component ─────────────────────────────────────────────────────
function SubtaskRow({
  sub,
  onToggle,
  onDelete,
  showAiBadge = false,
}: {
  sub: SubTask
  onToggle: () => void
  onDelete?: () => void
  showAiBadge?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '6px 0',
      borderBottom: '1px solid var(--border)',
      opacity: sub.done ? 0.45 : 1,
    }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        style={{
          width: 12,
          height: 12,
          minWidth: 12,
          border: `1px solid ${sub.done ? 'var(--text)' : 'var(--faint)'}`,
          borderRadius: 2,
          background: sub.done ? 'var(--text)' : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          position: 'relative',
        }}
      >
        {sub.done && (
          <div style={{
            width: 5,
            height: 2.5,
            borderLeft: '1.5px solid var(--bg)',
            borderBottom: '1.5px solid var(--bg)',
            transform: 'translateY(-0.5px) rotate(-45deg)',
          }} />
        )}
      </button>

      {/* Title */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text)',
        flex: 1,
        lineHeight: 1.4,
        textDecoration: sub.done ? 'line-through' : 'none',
        wordBreak: 'break-word',
      }}>
        {sub.title}
      </span>

      {/* AI badge — shown inline for AI-generated subtasks */}
      {showAiBadge && <AiBadge small />}

      {/* Delete button — only in subtask edit mode */}
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: '#c0392b',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}