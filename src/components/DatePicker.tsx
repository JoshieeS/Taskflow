// src/components/DatePicker.tsx
//
// THEORY: Why a custom calendar instead of a library?
//
// Every date picker library (react-datepicker, react-day-picker, etc.) ships
// with its own CSS that fights your design system. The monospace aesthetic
// is too specific to survive any third-party styling. Building a minimal
// calendar is ~100 lines and gives you exact control.
//
// Layout:
//   ┌ Quick chips row ──────────────────────────────┐
//   │ today  │ this week  │ someday  │ pick date ▾  │
//   └───────────────────────────────────────────────┘
//
//   ┌ Calendar dropdown (when "pick date" chip is active) ──┐
//   │   ← march 2026 →                                      │
//   │ su  mo  tu  we  th  fr  sa                            │
//   │                          1                            │
//   │  2   3   4   5   6   7   8                            │
//   │  ...                                                   │
//   └───────────────────────────────────────────────────────┘
//
// The `due` field stores either a quick-pick string ('today', 'this week',
// 'someday') or an ISO date string ('2026-04-15'). Both are plain strings
// in the database — no schema change needed.

'use client'

import { useState, useEffect, useRef } from 'react'

const QUICK_OPTIONS = ['today', 'this week', 'someday'] as const
const DAYS          = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']

function toISO(date: Date): string {
  // YYYY-MM-DD in local time (not UTC, to avoid timezone-off-by-one issues)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isQuickOption(value: string): boolean {
  return (QUICK_OPTIONS as readonly string[]).includes(value)
}

function parseISO(value: string): Date | null {
  if (isQuickOption(value) || !value) return null
  const d = new Date(value + 'T00:00:00') // force local time parsing
  return isNaN(d.getTime()) ? null : d
}

function formatDisplay(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .toLowerCase()
}

interface DatePickerProps {
  value    : string
  onChange : (value: string) => void
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const today        = new Date()
  const todayISO     = toISO(today)
  const selectedDate = parseISO(value)
  const isCustomDate = !isQuickOption(value) && value !== ''

  const [showCal,   setShowCal]   = useState(false)
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth())
  const [viewYear,  setViewYear]  = useState(selectedDate?.getFullYear() ?? today.getFullYear())
  const calRef = useRef<HTMLDivElement>(null)

  // Close calendar when clicking outside
  useEffect(() => {
    if (!showCal) return
    const handleClick = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setShowCal(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCal])

  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const monthLabel     = new Date(viewYear, viewMonth)
    .toLocaleString('en', { month: 'long' }).toLowerCase()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else                   setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else                    setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: number) => {
    const selected = new Date(viewYear, viewMonth, day)
    onChange(toISO(selected))
    setShowCal(false)
  }

  return (
    <div style={{ position: 'relative' }} ref={calRef}>

      {/* ── Quick chips + date picker toggle ── */}
      <div className="chip-row">
        {QUICK_OPTIONS.map(q => (
          <button
            key={q}
            className={`chip${value === q ? ' selected' : ''}`}
            onClick={() => { onChange(q); setShowCal(false) }}
          >
            {q}
          </button>
        ))}

        {/* "pick date" chip — shows selected date label when active */}
        <button
          className={`chip${isCustomDate ? ' selected' : ''}`}
          onClick={() => setShowCal(s => !s)}
        >
          {isCustomDate && selectedDate ? formatDisplay(selectedDate) : 'pick date ▾'}
        </button>
      </div>

      {/* ── Calendar dropdown ── */}
      {showCal && (
        <div style={{
          position:     'absolute',
          top:          'calc(100% + 8px)',
          left:          0,
          zIndex:        200,
          background:   'var(--bg)',
          border:       '1px solid var(--border)',
          borderRadius:  6,
          padding:       16,
          width:         240,
          boxShadow:    '0 4px 24px rgba(0,0,0,0.1)',
        }}>

          {/* Month navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button
              onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
            >←</button>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text)' }}>
              {monthLabel} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
            >→</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {/* Empty cells to align the first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day      = i + 1
              const iso      = toISO(new Date(viewYear, viewMonth, day))
              const isToday  = iso === todayISO
              const isSelected = iso === value
              // Disable past days (today is still selectable)
              const isPast   = iso < todayISO

              return (
                <button
                  key={day}
                  onClick={() => !isPast && handleDayClick(day)}
                  style={{
                    fontFamily:   'var(--mono)',
                    fontSize:      11,
                    padding:      '5px 0',
                    textAlign:    'center',
                    border:        isToday && !isSelected ? '1px solid var(--border)' : '1px solid transparent',
                    borderRadius:  3,
                    background:    isSelected ? 'var(--text)' : 'transparent',
                    color:         isSelected ? 'var(--bg)' : isPast ? 'var(--faint)' : 'var(--text)',
                    fontWeight:    isToday ? 600 : 400,
                    cursor:        isPast ? 'default' : 'pointer',
                    opacity:       isPast ? 0.35 : 1,
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Clear selection */}
          {isCustomDate && (
            <button
              onClick={() => { onChange('today'); setShowCal(false) }}
              style={{
                marginTop:    12,
                width:        '100%',
                fontFamily:   'var(--mono)',
                fontSize:      10,
                color:        'var(--muted)',
                background:   'none',
                border:        'none',
                cursor:       'pointer',
                letterSpacing: '0.06em',
                paddingTop:    8,
                borderTop:    '1px solid var(--border)',
              }}
            >
              // clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}