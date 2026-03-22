'use client'

import type { TabId } from '@/types'

interface HeaderProps {
  tab: TabId
  filter: 'today' | 'all'
  onFilterChange: (f: 'today' | 'all') => void
  pendingCount: number
  doneCount: number
  urgentCount: number
  progress: number
  userName: string
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'good morning,'
  if (h < 17) return 'good afternoon,'
  return 'good evening,'
}

function formatDate() {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .toLowerCase()
}

function formatYear() {
  return new Date()
    .toLocaleDateString('en-GB', { year: '2-digit' })
}

export default function Header({
  tab, filter, onFilterChange,
  pendingCount, doneCount, urgentCount, progress, userName
}: HeaderProps) {
  return (
    <div className="app-header">
      <div className="header-top">
        <div className="wordmark">task<span>flow</span></div>
        <div className="date-block" style={{ marginLeft: 'auto'}}>
          <div>{getGreeting()} {userName ? userName.split(' ')[0].toLowerCase() : '...'}</div>
          <div>{formatDate()}</div>
          <div>{formatYear()}</div>
        </div>
      </div>

      <div className="hero-title">
        {pendingCount === 0 ? 'all done.' : `${pendingCount} task${pendingCount !== 1 ? 's' : ''} left.`}
      </div>

      <div className="hero-sub">
        today — <span>{doneCount} completed</span> · <span>{urgentCount} urgent</span>
      </div>

      <div className="prog-row">
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="prog-pct">{progress}%</div>
      </div>

      {(tab === 'pending' || tab === 'done') && (
        <div className="tabs">
          {(['today', 'all'] as const).map(f => (
            <button
              key={f}
              className={`tab${filter === f ? ' active' : ''}`}
              style={{ fontSize: 10, letterSpacing: '0.1em' }}
              onClick={() => onFilterChange(f)}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="kbd-hint">
        <span className="kbd">n</span><span>new task</span>
      </div>
    </div>
  )
}