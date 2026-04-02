'use client'
 
import { useState } from 'react'
import type { Task } from '@/types'
 
interface AISummaryProps {
  tasks: Task[]
  scope: 'today' | 'all'
}
 
export default function AISummary({ tasks, scope }: AISummaryProps) {
  const [summary,  setSummary]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
 
  const generate = async () => {
    setLoading(true)
    setSummary(null)
    try {
      const res  = await fetch('/api/summarize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tasks, scope }),
      })
      const data = await res.json()
      setSummary(data.summary)
    } catch {
      setSummary('// summary unavailable right now')
    }
    setLoading(false)
  }
 
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:    10,
      }}>
        <div className="section-label" style={{ padding: 0 }}>ai summary</div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontFamily:   'var(--mono)',
            fontSize:      10,
            color:        'var(--muted)',
            background:   'none',
            border:       '1px solid var(--border)',
            borderRadius:  3,
            padding:      '3px 10px',
            cursor:        loading ? 'default' : 'pointer',
            opacity:       loading ? 0.5 : 1,
            letterSpacing: '0.04em',
          }}
        >
          {loading ? '...' : summary ? '↻ refresh' : 'generate'}
        </button>
      </div>
 
      {summary ? (
        <div style={{
          fontFamily:  'var(--mono)',
          fontSize:     12,
          color:       'var(--text)',
          lineHeight:   1.8,
          padding:     '14px',
          background:  'var(--surface)',
          border:      '1px solid var(--border)',
          borderRadius: 4,
          letterSpacing: '0.02em',
        }}>
          {summary}
        </div>
      ) : !loading && (
        <div style={{
          fontFamily:   'var(--mono)',
          fontSize:      11,
          color:        'var(--faint)',
          letterSpacing: '0.04em',
        }}>
          // tap generate to get an ai overview of your tasks
        </div>
      )}
    </div>
  )
}