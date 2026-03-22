'use client'
 
import { useState, useEffect } from 'react'
import type { NewTask } from '@/types'
import DatePicker from '@/components/DatePicker'
 
const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning'] as const
const PRIORITIES = ['high', 'medium', 'low'] as const
const DUE_OPTIONS = ['today', 'this week', 'someday'] as const
 
interface AddSheetProps {
  onClose : () => void
  onAdd   : (task: NewTask) => void
}
 
const INITIAL_FORM: NewTask = {
  title: '', category: 'personal', priority: 'medium',
  due: 'today', notes: '', done: false,
}
 
export default function AddSheet({ onClose, onAdd }: AddSheetProps) {
  const [form, setForm] = useState<NewTask>(INITIAL_FORM)
 
  const submit = () => {
    if (!form.title.trim()) return
    onAdd(form)
  }
 
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', handler)
    // Cleanup: runs when sheet unmounts, removing the listener
    return () => window.removeEventListener('keydown', handler)
  }, [form])  // form in deps so `submit` inside handler captures latest form state
 
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-btn cancel" onClick={onClose}>cancel</button>
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
          <DatePicker value={form.due} onChange={(val) => setForm(p => ({ ...p, due:val}))}/>
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
          <span className="kbd">⌘</span><span>+</span>
          <span className="kbd">↵</span><span>to add · </span>
          <span className="kbd">esc</span><span>to cancel</span>
        </div>
      </div>
    </div>
  )
}