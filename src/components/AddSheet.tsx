'use client'

import { useState, useEffect, useRef } from 'react'
import type { NewTask } from '@/types'
import DatePicker, { resolveQuickOption } from '@/components/DatePicker'

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning'] as const
const PRIORITIES = ['high', 'medium', 'low'] as const

const INITIAL_FORM: NewTask = {
  title: '', category: 'personal', priority: 'medium',
  due: 'today', notes: '', done: false,
}

interface AddSheetProps {
  onClose: () => void
  onAdd  : (task: NewTask) => void
}

export default function AddSheet({ onClose, onAdd }: AddSheetProps) {
  const [form,    setForm]    = useState<NewTask>(INITIAL_FORM)
  const [closing, setClosing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

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

  const submit = () => {
    if (!form.title.trim()) return
    const resolvedForm: NewTask = {
      ...form,
      due: resolveQuickOption(form.due),
    }

    setClosing(true)
    timerRef.current = setTimeout(() => {
      onAdd(resolvedForm)
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
            placeholder="what needs doing?"
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
          <div className="form-label">notes // optional</div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="any context..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />
        </div>

        <div className="kbd-hint" style={{ padding: '16px 24px 0' }}>
          <span className="kbd">↵</span><span>to add · </span>
          <span className="kbd">esc</span><span>to cancel</span>
        </div>
      </div>
    </div>
  )
}