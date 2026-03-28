'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Bell, Check, CheckCheck, Gavel, TrendingUp, CreditCard,
  Shield, AlertCircle, X, Trash2, ChevronRight, Volume2
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

const NOTIFICATION_ICONS: Record<string, any> = {
  BID_PLACED: Gavel,
  OUTBID: TrendingUp,
  AUCTION_WON: Check,
  AUCTION_ENDING: AlertCircle,
  AUCTION_ENDED: Gavel,
  PAYMENT_RECEIVED: CreditCard,
  PRODUCER_APPROVED: Shield,
  PRODUCER_REJECTED: X,
  SYSTEM: Bell,
}

const NOTIFICATION_COLORS: Record<string, string> = {
  BID_PLACED: 'text-blue-400 bg-blue-500/10',
  OUTBID: 'text-orange-400 bg-orange-500/10',
  AUCTION_WON: 'text-green-400 bg-green-500/10',
  AUCTION_ENDING: 'text-yellow-400 bg-yellow-500/10',
  AUCTION_ENDED: 'text-gray-400 bg-gray-500/10',
  PAYMENT_RECEIVED: 'text-green-400 bg-green-500/10',
  PRODUCER_APPROVED: 'text-green-400 bg-green-500/10',
  PRODUCER_REJECTED: 'text-red-400 bg-red-500/10',
  SYSTEM: 'text-gray-400 bg-gray-500/10',
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'A l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef(0)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return

    try {
      const res = await fetch('/api/notifications?limit=10')
      const data = await res.json()

      if (res.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)

        // Jouer un son si nouvelles notifications
        if (data.unreadCount > prevUnreadRef.current && prevUnreadRef.current > 0) {
          playNotificationSound()
        }
        prevUnreadRef.current = data.unreadCount
      }
    } catch {
      // Silently fail
    }
  }, [session])

  // Polling toutes les 5 secondes
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Fermer le dropdown en cliquant dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Son de notification
  const playNotificationSound = () => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.value = 0.1
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not available
    }
  }

  // Marquer comme lu
  const markAsRead = async (ids: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      })

      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } catch {}
  }

  // Tout marquer comme lu
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }

  // Cliquer sur une notification
  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markAsRead([notif.id])
    }
    if (notif.link) {
      router.push(notif.link)
      setOpen(false)
    }
  }

  if (!session?.user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        <Bell size={18} className={unreadCount > 0 ? 'text-white' : 'text-gray-400'} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-[380px] max-h-[520px] bg-[#111111] border border-[#222222] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-gray-400 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/5 flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Tout lire
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length > 0 ? (
              notifications.map((notif) => {
                const Icon = NOTIFICATION_ICONS[notif.type] || Bell
                const colorClass = NOTIFICATION_COLORS[notif.type] || 'text-gray-400 bg-gray-500/10'

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`
                      flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#222222]/50
                      ${notif.read ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-red-500/[0.03] hover:bg-red-500/[0.06]'}
                    `}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${notif.read ? 'text-gray-300' : 'text-white'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-gray-600 mt-1 block">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>

                    {/* Arrow */}
                    {notif.link && (
                      <ChevronRight size={14} className="text-gray-600 flex-shrink-0 mt-2" />
                    )}
                  </div>
                )
              })
            ) : (
              <div className="py-12 text-center">
                <Bell size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucune notification</p>
                <p className="text-[11px] text-gray-600 mt-1">
                  Tu recevras des alertes pour tes encheres ici
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-[#222222] p-2">
              <button
                onClick={() => { router.push('/notifications'); setOpen(false) }}
                className="w-full py-2 text-xs font-semibold text-red-500 hover:bg-red-500/5 rounded-lg transition"
              >
                Voir toutes les notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
