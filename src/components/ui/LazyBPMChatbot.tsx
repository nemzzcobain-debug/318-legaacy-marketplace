'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const BPMChatbot = dynamic(() => import('@/components/ui/BPMChatbot'), {
  ssr: false,
})

export default function LazyBPMChatbot() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const delay = window.matchMedia('(max-width: 767px)').matches ? 3500 : 1500
    let timer: ReturnType<typeof setTimeout> | undefined
    let idleId: number | undefined

    const showChatbot = () => setReady(true)

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(showChatbot, { timeout: delay })
    } else {
      timer = setTimeout(showChatbot, delay)
    }

    return () => {
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timer) clearTimeout(timer)
    }
  }, [])

  return ready ? <BPMChatbot /> : null
}
