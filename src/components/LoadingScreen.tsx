'use client'

import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  ready: boolean  
}

export default function LoadingScreen({ ready }: LoadingScreenProps) {
  const [visible,  setVisible]  = useState(true)
  const [fading,   setFading]   = useState(false)

  useEffect(() => {
    if (!ready) return

    // Start fade-out animation
    setFading(true)

    // Remove from DOM after animation completes
    const timer = setTimeout(() => setVisible(false), 400)
    return () => clearTimeout(timer)
  }, [ready])

  if (!visible) return null

  return (
    <div style={{
      position        : 'fixed',
      inset           : 0,
      background      : 'var(--bg)',
      zIndex          : 9999,
      display         : 'flex',
      flexDirection   : 'column',
      alignItems      : 'center',
      justifyContent  : 'center',
      gap             : 24,
      opacity         : fading ? 0 : 1,
      transition      : 'opacity 0.35s ease',
      pointerEvents   : fading ? 'none' : 'auto',
    }}>
      {/* Wordmark */}
      <div style={{
        fontFamily   : 'var(--mono)',
        fontSize     : 18,
        fontWeight   : 500,
        letterSpacing: '0.12em',
        color        : 'var(--muted)',
      }}>
        task<span style={{ color: 'var(--text)', fontWeight: 600 }}>flow</span>
      </div>

      {/* Animated progress bar */}
      <div style={{
        width       : 120,
        height      : 1,
        background  : 'var(--border)',
        borderRadius: 1,
        overflow    : 'hidden',
        position    : 'relative',
      }}>
        <div style={{
          position  : 'absolute',
          top       : 0,
          left      : 0,
          height    : '100%',
          background: 'var(--text)',
          borderRadius: 1,
          animation : 'loadingBar 1.2s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes loadingBar {
          0%   { left: -40%; width: 40%; }
          50%  { left: 20%;  width: 60%; }
          100% { left: 100%; width: 40%; }
        }
      `}</style>
    </div>
  )
}