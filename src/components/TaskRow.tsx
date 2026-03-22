'use client'

import type { Task } from '@/types'

const PRIORITY_DOTS: Record<string, string> = {
  high: '#c0392b',
  medium: '#b7791f',
  low: '#2d6a4f',
}

interface TaskRowProps {
  task: Task
  delay?: number
  onToggle: () => void
  onClick: () => void
}

function formatDue(due: string): string {
  if (['today', 'this week', 'someday'].includes(due)) return due
  const date = new Date(due + 'T00:00:00')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short'
  }).toLowerCase()
}

export default function TaskRow({ task, delay = 0, onToggle, onClick }: TaskRowProps) {
  return (
    <div
      className={`task-row${task.done ? ' done' : ''}`}
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <button
        className={`check${task.done ? ' checked' : ''}`}
        onClick={e => {
          e.stopPropagation()  // ← prevent row click from also firing
          onToggle()
        }}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      />
      <div className="task-main">
        <div className="task-text">{task.title}</div>
        {task.notes && <div className="task-notes-line">// {task.notes}</div>}
        <div className="task-meta">
          <span className="dot" style={{ background: PRIORITY_DOTS[task.priority] }} />
          <span className="meta-tag">{task.priority}</span>
          <span className="meta-tag">·</span>
          <span className="meta-tag">{task.category}</span>
          {task.due !== 'today' && (
            <>
              <span className="meta-tag">·</span>
              <span className="meta-tag">{formatDue(task.due)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}