'use client'

import type { Task } from '@/types'

const PRIORITY_DOTS: Record<string, string> = {
  high:   '#c0392b',
  medium: '#b7791f',
  low:    '#2d6a4f',
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Returns a human-readable due label for display in the task row.
// Returns null for tasks due today — we don't show a date label for those.
function getDueLabel(due: string, todayISO: string): { label: string; overdue: boolean } | null {
  if (!due || due === 'someday') return null

  // Legacy string 'today' or actual today's ISO date
  if (due === 'today' || due === todayISO) return null

  // Overdue — past date that isn't today
  if (due < todayISO) {
    const date     = new Date(due + 'T00:00:00')
    const diffMs   = new Date(todayISO + 'T00:00:00').getTime() - date.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    const label = diffDays === 1
      ? 'yesterday'
      : diffDays < 7
      ? `${diffDays}d ago`
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()

    return { label, overdue: true }
  }

  // Future date — format nicely
  const date      = new Date(due + 'T00:00:00')
  const diffMs    = date.getTime() - new Date(todayISO + 'T00:00:00').getTime()
  const diffDays  = Math.round(diffMs / (1000 * 60 * 60 * 24))

  const label = diffDays === 1
    ? 'tomorrow'
    : diffDays < 7
    ? date.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase()
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()

  return { label, overdue: false }
}

interface TaskRowProps {
  task    : Task
  delay?  : number
  onToggle: () => void
  onClick : () => void
}

export default function TaskRow({ task, delay = 0, onToggle, onClick }: TaskRowProps) {
  const todayISO  = toISO(new Date())
  const dueInfo   = getDueLabel(task.due, todayISO)
  const isOverdue = dueInfo?.overdue ?? false

  return (
    <div
      className={`task-row${task.done ? ' done' : ''}`}
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <button
        className={`check${task.done ? ' checked' : ''}`}
        onClick={e => { e.stopPropagation(); onToggle() }}
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

          {/* Due label — only shown for non-today tasks */}
          {dueInfo && (
            <>
              <span className="meta-tag">·</span>
              {isOverdue ? (
                // Overdue: subtle red dot + label, fits the minimalist theme
                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:           4,
                  fontSize:      10,
                  color:        '#c0392b',
                  fontFamily:   'var(--mono)',
                  letterSpacing: '0.04em',
                }}>
                  <span style={{ fontSize: 10 }}>!</span>
                  {dueInfo.label}
                </span>
              ) : (
                <span className="meta-tag">{dueInfo.label}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}