'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'

type ReportType = 'bug' | 'feature' | 'other'

interface BugReportProps {
  onClose: () => void
  userId : string | null
}

export default function BugReport({ onClose, userId }: BugReportProps) {
  const supabase = createBrowserClient()

  const [closing,    setClosing]    = useState(false)
  const [type,       setType]       = useState<ReportType>('bug')
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = () => {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(onClose, 240)
  }

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('// please fill in both fields')
      return
    }

    if (!userId) {
      setError('// user not authenticated')
      return
    }

    setSubmitting(true)
    setError('')

    const { error: dbError } = await supabase
      .from('bug_reports' as any)
      .insert({
        user_id:    userId,
        type,
        title:      title.trim(),
        body:       body.trim(),
        user_agent: navigator.userAgent,
      })

    setSubmitting(false)

    if (dbError) {
      setError(`// ${dbError.message}`)
    } else {
      setSubmitted(true)
      timerRef.current = setTimeout(close, 2000)
    }
  }

  const TYPES: { id: ReportType; label: string }[] = [
    { id: 'bug',     label: 'bug'             },
    { id: 'feature', label: 'feature request' },
    { id: 'other',   label: 'other'           },
  ]

  return (
    <div
      className={`overlay${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className={`sheet${closing ? ' closing' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-btn cancel" onClick={close}>cancel</button>
          <span className="sheet-title">report</span>
          <button
            className="sheet-btn add"
            onClick={submit}
            style={{ opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? '...' : 'send'}
          </button>
        </div>

        {submitted ? (
          <div style={{
            padding:     '40px 24px',
            textAlign:   'center',
            fontFamily:  'var(--mono)',
            fontSize:     12,
            color:       'var(--muted)',
            lineHeight:   1.8,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 8 }}>
              // received
            </div>
            thanks for the feedback. closing...
          </div>
        ) : (
          <>
            <div className="form-block" style={{ marginTop: 16 }}>
              <div className="form-label">type</div>
              <div className="chip-row">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`chip${type === t.id ? ' selected' : ''}`}
                    onClick={() => setType(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-block" style={{ marginTop: 18 }}>
              <div className="form-label">
                {type === 'bug' ? 'what went wrong?' : type === 'feature' ? 'what would you like?' : 'title'}
              </div>
              <input
                className="form-input"
                placeholder={type === 'bug' ? 'brief description of the issue' : 'brief summary'}
                value={title}
                onChange={e => { setTitle(e.target.value); setError('') }}
                autoFocus
              />
            </div>

            <div className="form-block" style={{ marginTop: 18 }}>
              <div className="form-label">
                {type === 'bug' ? 'steps to reproduce' : 'details'}
              </div>
              <textarea
                className="form-input"
                rows={4}
                placeholder={
                  type === 'bug'
                    ? '1. go to...\n2. tap...\n3. see error'
                    : 'describe what you have in mind...'
                }
                value={body}
                onChange={e => { setBody(e.target.value); setError('') }}
              />
            </div>

            {error && (
              <div style={{
                fontFamily:   'var(--mono)',
                fontSize:      11,
                color:        '#c0392b',
                padding:      '8px 24px 0',
                letterSpacing: '0.04em',
              }}>
                {error}
              </div>
            )}

            <div style={{
              fontFamily:   'var(--mono)',
              fontSize:      10,
              color:        'var(--muted)',
              padding:      '12px 24px 20px',
              letterSpacing: '0.04em',
            }}>
              // your device info will be attached automatically
            </div>
          </>
        )}
      </div>
    </div>
  )
}