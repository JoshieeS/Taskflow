'use client'

import { useState, useEffect, useRef } from 'react'

interface TaskTimerProps {
  taskId          : string
  timeSpentSeconds: number         // accumulated total from Supabase
  onSave          : (additionalSeconds: number) => void
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TaskTimer({ taskId, timeSpentSeconds, onSave }: TaskTimerProps) {
  const [running,    setRunning]    = useState(false)
  const [elapsed,    setElapsed]    = useState(0)   // current session seconds
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick every second while running
  useEffect(() => {
    if (running && sessionStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - sessionStart) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, sessionStart])

  // Stop timer if component unmounts while running
  useEffect(() => {
    return () => {
      if (running && elapsed > 0) {
        onSave(elapsed)
      }
    }
  }, [])

  const handleStart = () => {
    setSessionStart(Date.now())
    setElapsed(0)
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    if (elapsed > 0) {
      onSave(elapsed)
      setElapsed(0)
    }
  }

  const handleReset = () => {
    setRunning(false)
    setElapsed(0)
    // Save 0 additional seconds but update stored time to 0
    onSave(-timeSpentSeconds)  // negative cancels out the stored total
  }

  const displayTotal = timeSpentSeconds + elapsed

  return (
    <div style={{
      margin:       '0 24px',
      padding:      '14px 0',
      borderTop:    '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Label */}
      <div style={{
        fontFamily:   'var(--mono)',
        fontSize:      10,
        color:        'var(--faint)',
        letterSpacing: '0.12em',
        marginBottom:  10,
      }}>
        task timer
      </div>

      {/* Time display */}
      <div style={{
        fontFamily:   'var(--mono)',
        fontSize:      28,
        fontWeight:    600,
        color:         running ? 'var(--text)' : 'var(--muted)',
        letterSpacing: '-0.02em',
        lineHeight:    1,
        marginBottom:  12,
        transition:   'color 0.2s',
      }}>
        {formatTime(displayTotal)}
      </div>

      {/* Session indicator */}
      {running && elapsed > 0 && (
        <div style={{
          fontFamily:   'var(--mono)',
          fontSize:      10,
          color:        'var(--muted)',
          marginBottom:  10,
          letterSpacing: '0.04em',
        }}>
          // +{formatTime(elapsed)} this session
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!running ? (
          <button
            onClick={handleStart}
            style={{
              fontFamily:   'var(--mono)',
              fontSize:      11,
              background:   'var(--text)',
              color:        'var(--bg)',
              border:       'none',
              borderRadius:  3,
              padding:      '7px 16px',
              cursor:       'pointer',
              letterSpacing: '0.04em',
              minHeight:     36,
            }}
          >
            {timeSpentSeconds > 0 ? 'resume' : 'start'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              fontFamily:   'var(--mono)',
              fontSize:      11,
              background:   'transparent',
              color:        'var(--text)',
              border:       '1px solid var(--text)',
              borderRadius:  3,
              padding:      '7px 16px',
              cursor:       'pointer',
              letterSpacing: '0.04em',
              minHeight:     36,
            }}
          >
            stop
          </button>
        )}

        {/* Reset — only shown if there's time to reset */}
        {timeSpentSeconds > 0 && !running && (
          <button
            onClick={handleReset}
            style={{
              fontFamily:   'var(--mono)',
              fontSize:      11,
              background:   'transparent',
              color:        'var(--muted)',
              border:       '1px solid var(--border)',
              borderRadius:  3,
              padding:      '7px 12px',
              cursor:       'pointer',
              letterSpacing: '0.04em',
              minHeight:     36,
            }}
          >
            reset
          </button>
        )}

        {/* Running indicator */}
        {running && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:           5,
            fontFamily:   'var(--mono)',
            fontSize:      10,
            color:        'var(--muted)',
          }}>
            <span style={{
              width:           6,
              height:          6,
              borderRadius:   '50%',
              background:     '#c0392b',
              display:        'inline-block',
              animation:      'pulse 1s ease-in-out infinite',
            }} />
            recording
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}