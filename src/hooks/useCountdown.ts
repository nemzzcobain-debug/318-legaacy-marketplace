'use client'

import { useState, useEffect } from 'react'

interface CountdownResult {
  hours: number
  minutes: number
  seconds: number
  timeLeft: number
  urgent: boolean
  ended: boolean
  formatted: string
}

export function useCountdown(endTime: string | Date): CountdownResult {
  const endMs = new Date(endTime).getTime()

  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, endMs - Date.now()))

  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      const remaining = Math.max(0, endMs - Date.now())
      setTimeLeft(remaining)
      if (remaining <= 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [endMs, timeLeft])

  const hours = Math.floor(timeLeft / 3600000)
  const minutes = Math.floor((timeLeft % 3600000) / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)
  const urgent = timeLeft > 0 && timeLeft < 600000 // Moins de 10 min
  const ended = timeLeft === 0

  const pad = (n: number) => String(n).padStart(2, '0')
  const formatted = ended
    ? 'TERMINE'
    : hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`

  return { hours, minutes, seconds, timeLeft, urgent, ended, formatted }
}
