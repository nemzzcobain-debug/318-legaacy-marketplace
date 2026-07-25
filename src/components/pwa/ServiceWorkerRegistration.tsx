'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        // Le paramètre de version force les anciens appareils à récupérer le
        // service worker corrigé au lieu de garder un cache obsolète.
        .register('/sw.js?v=4', { updateViaCache: 'none' })
        .then((reg) => {
          console.log('SW registered:', reg.scope)

          // Vérifier tout de suite au chargement, puis régulièrement.
          void reg.update()

          // Check for updates every 60 minutes
          setInterval(() => {
            void reg.update()
          }, 60 * 60 * 1000)
        })
        .catch((err) => {
          console.log('SW registration failed:', err)
        })
    }
  }, [])

  return null
}
