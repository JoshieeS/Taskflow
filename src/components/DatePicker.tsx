'use client'

import { useState } from 'react'

const QUICK_OPTIONS = ['today', 'this week', 'someday'] as const
const DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']

function toISO(date: Date): string {
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
  const d = new Date(value + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatDisplay(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .toLowerCase()
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const today = new Date()
  const todayISO = toISO(today)
  const selectedDate = parseISO(value)
  const isCustomDate = !isQuickOption(value) && value !== ''

  const [showCal, setShowCal] = useState(false)
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth())
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const monthLabel = new Date(viewYear, viewMonth)
    .toLocaleString('en', { month: 'long' }).toLowerCase()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: number) => {
    const selected = new Date(viewYear, viewMonth, day)
    const iso = toISO(selected)
    console.log('[DatePicker] handleDayClick called — day:', day, '| iso:', iso)
    console.log('[DatePicker] calling onChange with:', iso)
    onChange(iso)
    console.log('[DatePicker] setShowCal(false)')
    setShowCal(false)
  }

  // Single root div catches ALL clicks — nothing propagates to the overlay
  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>

      {/* ── Quick chips + date picker toggle ── */}
      <div className="chip-row">
        {QUICK_OPTIONS.map(q => (
          <button
            key={q}
            className={`chip${value === q ? ' selected' : ''}`}
            onPointerDown={e => {
              e.preventDefault()
              console.log('[DatePicker] quick chip pressed:', q)
              onChange(q)
              setShowCal(false)
            }}
          >
            {q}
          </button>
        ))}

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
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          zIndex: 200,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 16,
          width: 240,
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
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
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const iso = toISO(new Date(viewYear, viewMonth, day))
              const isToday = iso === todayISO
              const isSelected = iso === value
              const isPast = iso < todayISO

              return (
                <button
                  key={day}
                  onPointerDown={e => {
                    if (isPast) return
                    e.preventDefault()
                    console.log('[DatePicker] day button pointerdown — day:', day, '| isPast:', isPast)
                    handleDayClick(day)
                  }}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    padding: '5px 0',
                    textAlign: 'center',
                    border: isToday && !isSelected ? '1px solid var(--border)' : '1px solid transparent',
                    borderRadius: 3,
                    background: isSelected ? 'var(--text)' : 'transparent',
                    color: isSelected ? 'var(--bg)' : isPast ? 'var(--faint)' : 'var(--text)',
                    fontWeight: isToday ? 600 : 400,
                    cursor: isPast ? 'default' : 'pointer',
                    opacity: isPast ? 0.35 : 1,
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
                marginTop: 12,
                width: '100%',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.06em',
                paddingTop: 8,
                borderTop: '1px solid var(--border)',
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