'use client'

import { useState, useEffect, useRef } from 'react'
import type { NewTask, SubTask } from '@/types'
import DatePicker, { resolveQuickOption } from '@/components/DatePicker'
import { extractDateFromTitle } from '@/lib/DateParser'
import { enhanceTaskInBackground } from '@/lib/AiTaskEnhancer'

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning'] as const
const PRIORITIES = ['high', 'medium', 'low'] as const

const INITIAL_FORM: NewTask = {
  title: '',
  category: 'personal',
  priority: 'medium',
  due: 'today',
  notes: '',
  done: false,
  subtasks: [],
  ai_enhanced: false,
  ai_title: false,
  time_spent_seconds: 0,
}

interface AddSheetProps {
  onClose: () => void
  // onAdd returns the created task id so we can pass it to background AI
  onAdd: (task: NewTask) => Promise<string | void>
}

export default function AddSheet({ onClose, onAdd }: AddSheetProps) {
  const [form, setForm] = useState<NewTask>(INITIAL_FORM)
  const [closing, setClosing] = useState(false)
  const [dateHint, setDateHint] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [subtaskInput, setSubtaskInput] = useState('')
  const [localSubtasks, setLocalSubtasks] = useState<SubTask[]>([])

  const close = () => {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(onClose, 240)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // ── Title change — run local date parser instantly (no network) ───────────
  const handleTitleChange = (value: string) => {
    const { cleanTitle, isoDate } = extractDateFromTitle(value)

    if (isoDate) {
      // Date found in title — apply it and show a hint
      setForm(p => ({ ...p, title: cleanTitle, due: isoDate }))
      setDateHint(isoDate)
    } else {
      setForm(p => ({ ...p, title: value }))
      setDateHint(null)
    }
  }

  const addSubtask = () => {
    if (!subtaskInput.trim()) return
    const newSub: SubTask = {
      id: Math.random().toString(36).slice(2),
      title: subtaskInput.trim(),
      done: false,
      ai_generated: false,
      created_at: new Date().toISOString(),
    }
    setLocalSubtasks(p => [...p, newSub])
    setSubtaskInput('')
  }

  const removeSubtask = (id: string) => {
    setLocalSubtasks(p => p.filter(s => s.id !== id))
  }

  // ── Submit — instant, no waiting for AI ──────────────────────────────────
  const submit = () => {
    if (!form.title.trim()) return

    const resolvedForm: NewTask = {
      ...form,
      due: resolveQuickOption(form.due),
      subtasks: localSubtasks
    }

    setClosing(true)
    timerRef.current = setTimeout(async () => {
      // 1. Save task immediately — user sees it right away
      const taskId = await onAdd(resolvedForm)

      // 2. Fire-and-forget background AI enhancement
      //    User never waits for this — it runs after the sheet closes
      if (taskId) {
        enhanceTaskInBackground(taskId, resolvedForm.title, [])
      }

      onClose()
    }, 240)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === 'Escape') close()
      if (e.key === 'Enter' && tag !== 'TEXTAREA') submit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [form, closing])

  return (
    <div
      className={`overlay${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className={`sheet${closing ? ' closing' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-btn cancel" onClick={close}>cancel</button>
          <span className="sheet-title">new task</span>
          <button className="sheet-btn add" onClick={submit}>add</button>
        </div>

        <div className="form-block">
          <div className="form-label">title</div>
          <input
            className="form-input"
            placeholder="what needs doing? (try: finish report by sunday)"
            value={form.title}
            onChange={e => handleTitleChange(e.target.value)}
            autoFocus
          />
          {/* Instant feedback when date is extracted from title */}
          {dateHint && (
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--muted)',
              marginTop: 5,
              letterSpacing: '0.04em',
            }}>
              // date detected → {dateHint}
            </div>
          )}
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
            onChange={val => { setForm(p => ({ ...p, due: val })); setDateHint(null) }}
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
                    onClick={() => removeSubtask(s.id)}
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
              value={subtaskInput}
              onChange={e => setSubtaskInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.stopPropagation()  // prevent parent Enter from submitting form
                  addSubtask()
                }
              }}
            />
            <button
              onClick={addSubtask}
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

        <div className="form-block" style={{ marginTop: 18 }}>
          <div className="form-label">notes // optional</div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="any context..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />
        </div>

        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--faint)',
          padding: '10px 24px 20px',
          letterSpacing: '0.04em',
        }}>
          // ai will analyse complexity in the background after adding
        </div>
      </div>
    </div>
  )
}