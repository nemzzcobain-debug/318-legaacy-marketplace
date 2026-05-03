'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import {
  Bell, Check, CheckCheck, Gavel, TrendingUp, CreditCard,
  Shield, AlertCircle, X, Trash2, Loader2, Filter, Music
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
  NEW_BEAT: Music,
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
  NEW_BEAT: 'text-[#e11d48] bg-[#e11d48]/10',
  SYSTEM: 'text-gray-400 bg-gray-500/10',
}

const TYPE_LABELS: Record<string, string> = {
  BID_PLACED: 'Enchère placée',
  OUTBID: 'Surenchéri',
  AUCTION_WON: 'Enchère gagnée',
  AUCTION_ENDING: 'Fin imminente',
  AUCTION_ENDED: 'Enchère terminée',
  PAYMENT_RECEIVED: 'Paiement reçu',
  PRODUCER_APPROVED: 'Producteur approuvé',
  PRODUCER_REJECTED: 'Producteur refusé',
  NEW_BEAT: 'Nouveau beat',
  SYSTEM: 'Système',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'Hier'

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    async function load() {
      try {
        const params = filter === 'unread' ? '?unread=true&limit=50' : '?limit=50'
        const res = await fetch(`/api/notifications${params}`)
        const data = await res.json()
        if (res.ok) {
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch {} finally {
        setLoading(false)
      }
    }

    load()
  }, [status, router, filter])

  const markAsRead = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ids }),
    })
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - ids.length))
    setSelectedIds(new Set())
  }

  const markAllAsRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const deleteNotifications = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ids }),
    })
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)))
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Notifications</h1>
            <p className="text-sm text-gray-400 mt-1">
              {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => markAsRead(Array.from(selectedIds))}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-1"
                >
                  <Check size={12} /> Marquer lu
                </button>
                <button
                  onClick={() => deleteNotifications(Array.from(selectedIds))}
                  className="px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition flex items-center gap-1"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              </>
            )}
            {unreadCount > 0 && selectedIds.size === 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-1.5 text-xs font-semibold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-1"
              >
                <CheckCheck size={12} /> Tout marquer comme lu
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setLoading(true) }}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                filter === f
                  ? 'text-red-500 bg-red-500/10 border-red-500/30'
                  : 'text-gray-400 bg-white/[0.02] border-[#222] hover:text-white'
              }`}
            >
              {f === 'all' ? 'Toutes' : 'Non lues'}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="space-y-1">
          {notifications.length > 0 ? (
            notifications.map((notif) => {
              const Icon = NOTIFICATION_ICONS[notif.type] || Bell
              const colorClass = NOTIFICATION_COLORS[notif.type] || 'text-gray-400 bg-gray-500/10'
              const isSelected = selectedIds.has(notif.id)

              return (
                <div
                  key={notif.id}
                  className={`
                    flex items-start gap-3 p-4 rounded-xl transition-colors cursor-pointer
                    ${notif.read ? 'bg-[#111111]' : 'bg-red-500/[0.04] border border-red-500/10'}
                    ${isSelected ? 'ring-1 ring-red-500/40' : ''}
                    hover:bg-white/[0.03]
                  `}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(notif.id) }}
                    className={`w-5 h-5 rounded border flex-shrink-0 mt-1 flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-red-500 border-red-500'
                        : 'border-[#333] hover:border-gray-400'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </button>

                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}
                    onClick={() => {
                      if (!notif.read) markAsRead([notif.id])
                      if (notif.link) router.push(notif.link)
                    }}
                  >
                    <Icon size={18} />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => {
                      if (!notif.read) markAsRead([notif.id])
                      if (notif.link) router.push(notif.link)
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass.split(' ')[0]}`}>
                        {TYPE_LABELS[notif.type] || notif.type}
                      </span>
                      {!notif.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                    </div>
                    <h4 className={`text-sm font-semibold ${notif.read ? 'text-gray-300' : 'text-white'}`}>
                      {notif.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-gray-600 mt-1.5 block">
                      {formatDate(notif.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-20">
              <Bell size={48} className="text-gray-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-400 mb-1">
                {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
              </h3>
              <p className="text-sm text-gray-600">
                {filter === 'unread'
                  ? 'Tu es à jour ! Toutes les notifications ont été lues.'
                  : 'Les alertes d\'enchères, paiements et mises à jour apparaîtront ici.'
                }
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
