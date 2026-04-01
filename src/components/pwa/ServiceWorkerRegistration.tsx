'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('SW registered:', reg.scope)

          // Check for updates every 60 minutes
          setInterval(() => {
            reg.update()
          }, 60 * 60 * 1000)
        })
        .catch((err) => {
          console.log('SW registration failed:', err)
        })
    }
  }, [])

  return null
}
