'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[sw] registered, scope:', reg.scope)
    }).catch(err => {
      console.error('[sw] registration failed:', err)
    })

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[sw] new build detected:', event.data.buildId, '— reloading')
        setTimeout(() => window.location.reload(), 500)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}