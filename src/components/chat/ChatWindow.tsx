'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Send, ArrowLeft, Loader2, Music, User as UserIcon } from 'lucide-react'
import Link from 'next/link'

interface MessageItem {
  id: string
  content: string
  read: boolean
  senderId: string
  createdAt: string
  sender: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
  }
}

interface OtherUser {
  id: string
  name: string
  displayName: string | null
  avatar: string | null
  role: string
}

interface Props {
  conversationId: string
  otherUser: OtherUser
  onBack: () => void
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ChatWindow({ conversationId, otherUser, onBack }: Props) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const userId = session?.user?.id
  const otherName = otherUser.displayName || otherUser.name
  const isProducer = otherUser.role === 'PRODUCER' || otherUser.role === 'ADMIN'

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`)
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages || [])
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [conversationId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    setMessages([])
    fetchMessages()
  }, [fetchMessages])

  // Scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('auto')
    }
  }, [messages])

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [conversationId])

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)

    // Optimistic update
    const tempMessage: MessageItem = {
      id: `temp-${Date.now()}`,
      content,
      read: false,
      senderId: userId || '',
      createdAt: new Date().toISOString(),
      sender: {
        id: userId || '',
        name: session?.user?.name || '',
        displayName: null,
        avatar: null,
      },
    }
    setMessages((prev) => [...prev, tempMessage])
    scrollToBottom()

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? data.message : m))
        )
      } else {
        // Rollback
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id))
        setNewMessage(content)
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id))
      setNewMessage(content)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageItem[] }[] = []
  messages.forEach((msg) => {
    const dateKey = new Date(msg.createdAt).toDateString()
    const last = groupedMessages[groupedMessages.length - 1]
    if (last && last.date === dateKey) {
      last.messages.push(msg)
    } else {
      groupedMessages.push({ date: dateKey, messages: [msg] })
    }
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e] bg-[#111111]">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-white/5 transition"
        >
          <ArrowLeft size={18} className="text-gray-400" />
        </button>

        <Link
          href={isProducer ? `/producer/${otherUser.id}` : '#'}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {otherName[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white truncate">{otherName}</span>
              {isProducer && (
                <span className="text-[9px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                  PRODUCTEUR
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-500">
              {isProducer ? 'Producteur verifie' : 'Artiste'}
            </span>
          </div>
        </Link>

        {isProducer && (
          <Link
            href={`/producer/${otherUser.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 bg-white/5 hover:bg-white/10 transition"
          >
            <Music size={12} /> Profil
          </Link>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-gray-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <Music size={28} className="text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-300 mb-1">
              Debut de la conversation
            </h3>
            <p className="text-xs text-gray-500 max-w-xs">
              Envoie un message a {otherName} pour demarrer la discussion
            </p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#1e1e2e]" />
                <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">
                  {formatDateSeparator(group.messages[0].createdAt)}
                </span>
                <div className="flex-1 h-px bg-[#1e1e2e]" />
              </div>

              {/* Messages */}
              {group.messages.map((msg, i) => {
                const isMine = msg.senderId === userId
                const showAvatar =
                  !isMine &&
                  (i === 0 || group.messages[i - 1]?.senderId !== msg.senderId)

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 mb-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Other user avatar */}
                    {!isMine && (
                      <div className="w-7 flex-shrink-0">
                        {showAvatar && (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[10px] font-bold text-white">
                            {otherName[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${
                        isMine
                          ? 'bg-red-600 text-white rounded-br-md'
                          : 'bg-[#1a1a2e] text-gray-200 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                      <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[9px] ${isMine ? 'text-red-200/60' : 'text-gray-600'}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isMine && msg.read && (
                          <span className="text-[9px] text-red-200/60">✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#1e1e2e] p-3 bg-[#111111]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message a ${otherName}...`}
            rows={1}
            className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:border-red-500/50 focus:outline-none transition max-h-32"
            style={{ minHeight: '42px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 128) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              newMessage.trim()
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-white/5 text-gray-600'
            }`}
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
