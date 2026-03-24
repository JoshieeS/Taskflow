'use client'

import { useState, useRef } from 'react'
import type { Task } from '@/types'

interface ExportSheetProps {
  tasks: Task[]
  onClose: () => void
}

type DateFilter = 'today' | 'tomorrow' | 'next week' | 'someday' | 'all' | 'pending' | 'done'
type GroupBy = 'none' | 'priority' | 'category'

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toISO(d)
}

function getNextWeekRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  const daysUntilSunday = 7 - now.getDay();
  start.setDate(now.getDate() + daysUntilSunday);
  console.log(start)

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  console.log(end)

  return { start: toISO(start), end: toISO(end) }
}

function formatDue(due: string): string {
  if (['someday'].includes(due)) return due
  const todayISO = toISO(new Date())
  const tomorrowISO = getTomorrowISO()
  if (due === 'today' || due === todayISO) return 'today'
  if (due === tomorrowISO) return 'tomorrow'
  const date = new Date(due + 'T00:00:00')
  if (isNaN(date.getTime())) return due
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
}

function buildExport(
  tasks: Task[],
  dateFilter: DateFilter,
  groupBy: GroupBy,
  includeDone: boolean
): string {
  const todayISO = toISO(new Date())
  const tomorrowISO = getTomorrowISO()
  const nextWeek = getNextWeekRange()

  let filtered = tasks.filter(t => {
    if (dateFilter === 'all') return true
    if (dateFilter === 'pending') return !t.done
    if (dateFilter === 'done') return t.done

    if (dateFilter === 'today') {
      // today = legacy 'today' string OR today's ISO OR overdue
      if (t.due === 'someday') return false
      if (t.due === 'today') return true
      if (t.due.match(/^\d{4}-\d{2}-\d{2}$/)) return t.due <= todayISO
      return false
    }

    if (dateFilter === 'tomorrow') {
      // tomorrow = tasks with tomorrow's ISO date
      return t.due === tomorrowISO
    }

    if (dateFilter === 'next week') {
      if (!t.due.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
      // Use >= start and < end for a clean Sunday-to-Sunday window
      return t.due >= nextWeek.start && t.due < nextWeek.end;
    }

    if (dateFilter === 'someday') return t.due === 'someday'

    return true
  })

  if (!includeDone) filtered = filtered.filter(t => !t.done)

  if (!filtered.length) return '// no tasks match this filter'

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).toLowerCase()

  const header = dateFilter === 'today'
    ? `taskflow — ${today}`
    : `taskflow — ${dateFilter} tasks`

  const bullet = (task: Task) => {
    const status = task.done ? '✓' : '○'
    const due = formatDue(task.due)
    const duePart = due !== 'today' ? ` [${due}]` : ''
    const notes = task.notes ? `\n     ${task.notes}` : ''
    return `${status} ${task.title}${duePart}${notes}`
  }

  if (groupBy === 'none') {
    const sorted = [
      ...filtered.filter(t => !t.done),
      ...filtered.filter(t => t.done),
    ]
    return `${header}\n\n${sorted.map(bullet).join('\n')}`
  }

  if (groupBy === 'priority') {
    const order = ['high', 'medium', 'low']
    const sections = order
      .map(p => {
        const group = filtered.filter(t => t.priority === p)
        if (!group.length) return null
        return `• ${p}\n${group.map(t => `  ${bullet(t)}`).join('\n')}`
      })
      .filter(Boolean)
    return `${header}\n\n${sections.join('\n\n')}`
  }

  if (groupBy === 'category') {
    const cats = [...new Set(filtered.map(t => t.category))]
    const sections = cats.map(c => {
      const group = filtered.filter(t => t.category === c)
      return `• ${c}\n${group.map(t => `  ${bullet(t)}`).join('\n')}`
    })
    return `${header}\n\n${sections.join('\n\n')}`
  }

  return ''
}

export default function ExportSheet({ tasks, onClose }: ExportSheetProps) {
  const [closing, setClosing] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [includeDone, setIncludeDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = () => {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(onClose, 240)
  }

  const exported = buildExport(tasks, dateFilter, groupBy, includeDone)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exported)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = exported
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const DATE_FILTERS: { id: DateFilter; label: string }[] = [
    { id: 'today', label: 'today' },
    { id: 'tomorrow', label: 'tomorrow' },
    { id: 'next week', label: 'next week' },
    { id: 'someday', label: 'someday' },
    { id: 'pending', label: 'pending' },
    { id: 'all', label: 'all' },
  ]

  const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
    { id: 'none', label: 'none' },
    { id: 'priority', label: 'priority' },
    { id: 'category', label: 'category' },
  ]

  const taskCount = exported
    .split('\n')
    .filter(l => l.startsWith('○') || l.startsWith('✓') || l.trimStart().startsWith('○') || l.trimStart().startsWith('✓'))
    .length

  return (
    <div
      className={`overlay${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className={`sheet${closing ? ' closing' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-btn cancel" onClick={close}>close</button>
          <span className="sheet-title">export tasks</span>
          <button
            className="sheet-btn add"
            onClick={handleCopy}
            style={{ minWidth: 60 }}
          >
            {copied ? 'copied ✓' : 'copy'}
          </button>
        </div>

        <div className="form-block" style={{ marginTop: 16 }}>
          <div className="form-label">which tasks</div>
          <div className="chip-row">
            {DATE_FILTERS.map(f => (
              <button
                key={f.id}
                className={`chip${dateFilter === f.id ? ' selected' : ''}`}
                onClick={() => setDateFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-block" style={{ marginTop: 16 }}>
          <div className="form-label">group by</div>
          <div className="chip-row">
            {GROUP_OPTIONS.map(g => (
              <button
                key={g.id}
                className={`chip${groupBy === g.id ? ' selected' : ''}`}
                onClick={() => setGroupBy(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-block" style={{ marginTop: 16 }}>
          <div className="form-label">include completed</div>
          <div className="chip-row">
            <button
              className={`chip${!includeDone ? ' selected' : ''}`}
              onClick={() => setIncludeDone(false)}
            >pending only</button>
            <button
              className={`chip${includeDone ? ' selected' : ''}`}
              onClick={() => setIncludeDone(true)}
            >include done</button>
          </div>
        </div>

        <div className="form-block" style={{ marginTop: 10 }}>
          <div className="form-label">preview</div>
          <pre
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: 14,
              marginTop: 6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.8,
              maxHeight: 220,
              overflowY: 'auto',
            }}>
            {exported}
          </pre>
        </div>

        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--muted)',
          padding: '10px 24px 20px',
          letterSpacing: '0.04em',
        }}>
          // {taskCount} tasks · tap copy to clipboard
        </div>
      </div>
    </div>
  )
}