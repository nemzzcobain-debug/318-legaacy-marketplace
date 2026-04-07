'use client'

import { useCountdown } from '@/hooks/useCountdown'
import { Flame, Clock } from 'lucide-react'

interface Props {
  endTime: string | Date
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export default function CountdownTimer({ endTime, size = 'md', showIcon = true }: Props) {
  const { formatted, urgent, ended } = useCountdown(endTime)

  if (ended) {
    return <span className="text-gray-400 font-semibold text-sm">TERMINE</span>
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-xl px-3 py-1.5',
  }

  return (
    <div className="flex items-center gap-1.5">
      {showIcon && urgent && <Flame size={size === 'lg' ? 20 : 14} className="text-[#ff4757]" />}
      {showIcon && !urgent && <Clock size={size === 'lg' ? 18 : 12} className="text-gray-400" />}
      <span
        className={`
          font-mono font-bold rounded-md inline-flex items-center
          ${sizeClasses[size]}
          ${urgent
            ? 'text-[#ff4757] bg-[#ff475720] border border-[#ff475740] animate-countdown-urgent'
            : 'text-white bg-white/5 border border-[#1e1e2e]'
          }
        `}
      >
        {formatted}
      </span>
    </div>
  )
}
