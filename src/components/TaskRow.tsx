'use client'

import type { Task } from '@/types'
import { getCategoryColor } from '@/lib/CategoryColors'

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

function getDueLabel(due: string, todayISO: string): { label: string; overdue: boolean } | null {
  if (!due || due === 'someday') return null
  if (due === 'today' || due === todayISO) return null
  if (due < todayISO) {
    const date    = new Date(due + 'T00:00:00')
    const diffMs  = new Date(todayISO + 'T00:00:00').getTime() - date.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    const label   = diffDays === 1 ? 'yesterday' : diffDays < 7 ? `${diffDays}d ago`
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
    return { label, overdue: true }
  }
  const date     = new Date(due + 'T00:00:00')
  const diffMs   = date.getTime() - new Date(todayISO + 'T00:00:00').getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const label    = diffDays === 1 ? 'tomorrow'
    : diffDays < 7 ? date.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase()
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
  const todayISO     = toISO(new Date())
  const dueInfo      = getDueLabel(task.due, todayISO)
  const isOverdue    = dueInfo?.overdue ?? false
  const categoryColor = getCategoryColor(task.category)

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
          {/* Priority dot */}
          <span className="dot" style={{ background: PRIORITY_DOTS[task.priority] }} />
          <span className="meta-tag">{task.priority}</span>
          <span className="meta-tag">·</span>

          {/* Category with colour */}
          <span style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:           3,
            fontSize:      10,
            color:         categoryColor,
            fontFamily:   'var(--mono)',
            letterSpacing: '0.04em',
          }}>
            <span style={{
              width:        5,
              height:       5,
              borderRadius: '50%',
              background:   categoryColor,
              display:      'inline-block',
              flexShrink:   0,
            }} />
            {task.category}
          </span>

          {/* Due date */}
          {dueInfo && (
            <>
              <span className="meta-tag">·</span>
              {isOverdue ? (
                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:           3,
                  fontSize:      10,
                  color:        '#c0392b',
                  fontFamily:   'var(--mono)',
                  letterSpacing: '0.04em',
                }}>
                  <span>!</span>{dueInfo.label}
                </span>
              ) : (
                <span className="meta-tag">{dueInfo.label}</span>
              )}
            </>
          )}

          {/* AI badge */}
          {task.ai_enhanced && (
            <span style={{
              fontFamily:   'var(--mono)',
              fontSize:      9,
              color:        'var(--faint)',
              border:       '1px solid var(--border)',
              borderRadius:  2,
              padding:      '1px 3px',
              letterSpacing: '0.04em',
            }}>
              ai
            </span>
          )}

          {/* Timer badge if task has tracked time */}
          {task.time_spent_seconds > 0 && (
            <span style={{
              fontFamily:   'var(--mono)',
              fontSize:      9,
              color:        'var(--faint)',
              letterSpacing: '0.04em',
            }}>
              ⏱ {Math.round(task.time_spent_seconds / 60)}m
            </span>
          )}
        </div>
      </div>
    </div>
  )
}