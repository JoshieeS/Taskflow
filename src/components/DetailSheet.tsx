'use client'
 
import { useEffect } from 'react'
import type { Task } from '@/types'
 
const PRIORITY_DOTS: Record<string, string> = {
  high: '#c0392b', medium: '#b7791f', low: '#2d6a4f',
}
 
interface DetailSheetProps {
  task    : Task
  tasks   : Task[]          // full task list so we show latest state
  onClose : () => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}
 
export default function DetailSheet({
  task: initialTask, tasks, onClose, onToggle, onDelete
}: DetailSheetProps) {
  // Get the latest version of this task from the live task list.
  // If we used `initialTask` directly, checking done on another device
  // wouldn't reflect in the open detail sheet.
  const task = tasks.find(t => t.id === initialTask.id) ?? initialTask
 
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
 
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="detail-title">{task.title}</div>
        <div className="detail-row">
          <span className="detail-key">priority</span>
          <span className="detail-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: PRIORITY_DOTS[task.priority], display: 'inline-block' }} />
            {task.priority}
          </span>
        </div>
        <div className="detail-row"><span className="detail-key">category</span><span className="detail-val">{task.category}</span></div>
        <div className="detail-row"><span className="detail-key">due</span><span className="detail-val">{task.due}</span></div>
        <div className="detail-row"><span className="detail-key">status</span><span className="detail-val">{task.done ? 'complete' : 'pending'}</span></div>
        {task.notes && <div className="detail-note">// {task.notes}</div>}
        <div className="detail-actions">
          <button className="detail-btn danger" onClick={() => onDelete(task.id)}>delete</button>
          <button className="detail-btn primary" onClick={() => { onToggle(task.id); onClose(); }}>
            {task.done ? 'mark pending' : 'mark done'}
          </button>
        </div>
      </div>
    </div>
  )
}