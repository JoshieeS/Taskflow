'use client'

import { useState } from 'react'
import type { Task } from '@/types'
import { getCategoryColor } from '@/lib/CategoryColors'

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

interface CalendarViewProps {
  tasks  : Task[]
  onClick: (task: Task) => void
}

export default function CalendarView({ tasks, onClick }: CalendarViewProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  const today    = new Date()
  const todayISO = toISO(today)

  // Build 7-day window starting from Monday of the offset week
  const monday = new Date(today)
  const dayOfWeek = today.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  monday.setDate(monday.getDate() + daysToMonday + weekOffset * 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const date    = addDays(monday, i)
    const iso     = toISO(date)
    const isToday = iso === todayISO
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase()
    const dayNum  = date.getDate()
    const month   = date.toLocaleDateString('en-GB', { month: 'short' }).toLowerCase()

    // Tasks for this day
    const dayTasks = tasks.filter(t => {
      if (t.due === 'today' && iso === todayISO) return true
      if (t.due === iso) return true
      return false
    })

    return { date, iso, isToday, dayName, dayNum, month, dayTasks }
  })

  const weekLabel = (() => {
    const start = days[0]
    const end   = days[6]
    if (start.date.getMonth() === end.date.getMonth()) {
      return `${start.date.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase()} ${start.date.getFullYear()}`
    }
    return `${start.date.toLocaleDateString('en-GB', { month: 'short' }).toLowerCase()} – ${end.date.toLocaleDateString('en-GB', { month: 'short' }).toLowerCase()} ${end.date.getFullYear()}`
  })()

  return (
    <div className="body">
      {/* Week navigation */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        padding:        '20px 0 16px',
        borderBottom:   '1px solid var(--border)',
        marginBottom:    16,
      }}>
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 16 }}
        >←</button>
        <div style={{
          fontFamily:   'var(--mono)',
          fontSize:      11,
          color:        weekOffset === 0 ? 'var(--text)' : 'var(--muted)',
          fontWeight:    weekOffset === 0 ? 600 : 400,
          letterSpacing: '0.04em',
        }}>
          {weekOffset === 0 ? 'this week' : weekLabel}
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                fontFamily:   'var(--mono)',
                fontSize:      10,
                color:        'var(--muted)',
                background:   'none',
                border:       '1px solid var(--border)',
                borderRadius:  3,
                padding:      '1px 6px',
                cursor:       'pointer',
                marginLeft:    10,
              }}
            >
              today
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 16 }}
        >→</button>
      </div>

      {/* Day columns */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap:                  4,
        minHeight:            300,
      }}>
        {days.map(day => (
          <div key={day.iso} style={{ minWidth: 0 }}>
            {/* Day header */}
            <div style={{
              textAlign:    'center',
              marginBottom:  8,
              padding:      '6px 2px',
              borderRadius:  4,
              background:    day.isToday ? 'var(--text)' : 'transparent',
            }}>
              <div style={{
                fontFamily:   'var(--mono)',
                fontSize:      9,
                color:         day.isToday ? 'var(--bg)' : 'var(--faint)',
                letterSpacing: '0.08em',
                lineHeight:    1.4,
              }}>
                {day.dayName}
              </div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize:    13,
                fontWeight:  600,
                color:       day.isToday ? 'var(--bg)' : 'var(--text)',
                lineHeight:  1.2,
              }}>
                {day.dayNum}
              </div>
            </div>

            {/* Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {day.dayTasks.length === 0 ? (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize:    9,
                  color:      'var(--faint)',
                  textAlign:  'center',
                  padding:    '8px 0',
                }}>
                  –
                </div>
              ) : (
                day.dayTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => onClick(task)}
                    style={{
                      fontFamily:   'var(--mono)',
                      fontSize:      9,
                      color:         task.done ? 'var(--faint)' : 'var(--text)',
                      background:   'var(--surface)',
                      border:       `1px solid ${getCategoryColor(task.category)}33`,
                      borderLeft:   `2px solid ${getCategoryColor(task.category)}`,
                      borderRadius:  3,
                      padding:      '4px 5px',
                      cursor:       'pointer',
                      textAlign:    'left',
                      lineHeight:    1.3,
                      textDecoration: task.done ? 'line-through' : 'none',
                      opacity:       task.done ? 0.5 : 1,
                      width:        '100%',
                      overflow:     'hidden',
                      whiteSpace:   'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                    title={task.title}
                  >
                    {task.title}
                    {task.time_spent_seconds > 0 && (
                      <span style={{ color: 'var(--faint)', marginLeft: 3 }}>
                        ⏱{formatTime(task.time_spent_seconds)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Someday tasks */}
      {(() => {
        const somedayTasks = tasks.filter(t => t.due === 'someday' && !t.done)
        if (!somedayTasks.length) return null
        return (
          <div style={{ marginTop: 24 }}>
            <div className="section-label">someday</div>
            {somedayTasks.map(task => (
              <div
                key={task.id}
                className="task-row"
                onClick={() => onClick(task)}
                style={{ cursor: 'pointer' }}
              >
                <span style={{
                  width:        5,
                  height:       5,
                  borderRadius: '50%',
                  background:   getCategoryColor(task.category),
                  display:      'inline-block',
                  flexShrink:   0,
                  marginTop:    4,
                }} />
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize:    12,
                  color:      'var(--text)',
                  flex:        1,
                }}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}