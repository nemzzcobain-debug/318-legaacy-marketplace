'use client'

import { useState, useRef, useEffect } from 'react'
import { getBPMResponse, WHATSAPP_LINK, type BPMResponse } from '@/lib/bpm-knowledge'

// ─── Types ───
interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

interface EscalationInfo {
  active: boolean
  step: 'email' | 'problem' | 'confirm'
  email?: string
  problemType?: string
  reason?: string
}

// ─── BPM Logo SVG ───
function BPMLogo({ size = 48, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div className={`relative ${pulse ? 'animate-pulse' : ''}`}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Metronome triangle body */}
        <path
          d="M50 8 L82 88 H18 Z"
          fill="url(#metronomeGrad)"
          stroke="#e11d48"
          strokeWidth="2"
        />
        {/* Inner triangle cutout for depth */}
        <path
          d="M50 22 L72 80 H28 Z"
          fill="#1a1a2e"
          opacity="0.85"
        />
        {/* Question mark cut into the metronome */}
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fill="url(#questionGrad)"
          fontSize="36"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
        >
          ?
        </text>
        {/* LED dot at the top - animated glow */}
        <circle cx="50" cy="14" r="6" fill="#e11d48">
          <animate
            attributeName="opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="50" cy="14" r="6" fill="url(#ledGlow)" opacity="0.6">
          <animate
            attributeName="r"
            values="6;9;6"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        {/* Small LED accent dots */}
        <circle cx="38" cy="82" r="2.5" fill="#ff6b6b" opacity="0.8" />
        <circle cx="62" cy="82" r="2.5" fill="#ff6b6b" opacity="0.8" />
        {/* BPM text at bottom */}
        <text
          x="50"
          y="96"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="10"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
          letterSpacing="2"
        >
          BPM
        </text>
        {/* Gradients */}
        <defs>
          <linearGradient id="metronomeGrad" x1="50" y1="8" x2="50" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="50%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#1a1a2e" />
          </linearGradient>
          <linearGradient id="questionGrad" x1="50" y1="40" x2="50" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#ff6b6b" />
          </linearGradient>
          <radialGradient id="ledGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
}

// ─── Main Chatbot Component ───
export default function BPMChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [escalation, setEscalation] = useState<EscalationInfo>({ active: false, step: 'email' })
  const [hasGreeted, setHasGreeted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Welcome message
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      setHasGreeted(true)
      setTimeout(() => {
        addBotMessage("Yo ! Je suis **BPM**, l'assistant IA de 318 LEGAACY. Pose-moi tes questions sur la marketplace, les enchères, ton compte... Je gère ! Et si c'est trop complexe, je te connecte direct à l'équipe humaine.")
      }, 500)
    }
  }, [isOpen, hasGreeted])

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + '-bot',
      text,
      sender: 'bot',
      timestamp: new Date(),
    }])
  }

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + '-user',
      text,
      sender: 'user',
      timestamp: new Date(),
    }])
  }

  const startEscalation = (reason: string) => {
    setEscalation({ active: true, step: 'email', reason })
    setTimeout(() => {
      addBotMessage("Avant de te connecter à notre équipe, j'ai besoin de quelques infos.\n\n📧 **Quel est ton email ?**")
    }, 800)
  }

  const handleWhatsAppRedirect = (email: string, problemType: string) => {
    const encodedMessage = encodeURIComponent(
      `Bonjour, je viens du chatbot BPM de 318 LEGAACY Marketplace.\n\n` +
      `📧 Email : ${email}\n` +
      `📌 Problème : ${problemType}\n\n` +
      `Merci de m'aider !`
    )
    window.open(`${WHATSAPP_LINK}?text=${encodedMessage}`, '_blank')
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    addUserMessage(trimmed)
    setInput('')
    setIsTyping(true)

    // Handle escalation flow
    if (escalation.active) {
      handleEscalationFlow(trimmed)
      return
    }

    // Normal flow
    setTimeout(() => {
      const response = getBPMResponse(trimmed)
      setIsTyping(false)

      if (response.shouldEscalate) {
        addBotMessage(response.message)
        setTimeout(() => {
          startEscalation(response.escalateReason || 'Escalade automatique')
        }, 1000)
      } else {
        addBotMessage(response.message)
      }
    }, 600 + Math.random() * 800)
  }

  const handleEscalationFlow = (text: string) => {
    setTimeout(() => {
      setIsTyping(false)

      if (escalation.step === 'email') {
        // Validate email loosely
        if (text.includes('@') && text.includes('.')) {
          setEscalation(prev => ({ ...prev, step: 'problem', email: text }))
          addBotMessage("Merci ! Maintenant, **décris brièvement ton problème** (en une phrase) :")
        } else {
          addBotMessage("Hmm, ça ne ressemble pas à un email valide. Peux-tu réessayer ? (ex: ton@email.com)")
        }
      } else if (escalation.step === 'problem') {
        setEscalation(prev => ({ ...prev, step: 'confirm', problemType: text }))
        addBotMessage(
          `Parfait, voilà le résumé :\n\n` +
          `📧 **Email** : ${escalation.email}\n` +
          `📌 **Problème** : ${text}\n\n` +
          `Je vais t'ouvrir **WhatsApp** pour parler directement avec notre équipe. Clique sur le bouton ci-dessous !`
        )
        // Reset escalation after redirect
        setTimeout(() => {
          setEscalation({ active: false, step: 'email' })
        }, 500)
        handleWhatsAppRedirect(escalation.email || '', text)
      }
    }, 500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Format bot messages (simple markdown-like)
  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <>
      {/* ─── Floating Button ─── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed z-50 transition-all duration-300 shadow-2xl hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bottom-[440px] sm:bottom-[520px] right-4 sm:right-6'
            : 'bottom-4 sm:bottom-6 right-4 sm:right-6'
        }`}
        style={{
          background: 'radial-gradient(circle at 30% 30%, #2a0a1a, #0d0d1a)',
          borderRadius: '50%',
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #e11d48',
          boxShadow: '0 0 20px rgba(225, 29, 72, 0.4), 0 4px 15px rgba(0,0,0,0.5)',
        }}
        aria-label={isOpen ? 'Fermer le chat BPM' : 'Ouvrir le chat BPM'}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <BPMLogo size={42} />
        )}
      </button>

      {/* ─── Chat Window ─── */}
      {isOpen && (
        <div
          className="fixed z-40 bottom-4 sm:bottom-6 right-4 sm:right-6 flex flex-col overflow-hidden"
          style={{
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(480px, calc(100vh - 120px))',
            borderRadius: '16px',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            background: 'linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 100%)',
            boxShadow: '0 0 30px rgba(225, 29, 72, 0.15), 0 10px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{
              background: 'linear-gradient(90deg, #1a0a1a, #0d0d1a)',
              borderBottom: '1px solid rgba(225, 29, 72, 0.2)',
            }}
          >
            <BPMLogo size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm flex items-center gap-2">
                BPM Agent
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <div className="text-gray-400 text-xs">Assistant IA · 318 LEGAACY</div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1"
              aria-label="Réduire"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 10 14 10 20" />
                <line x1="14" y1="10" x2="21" y2="3" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white rounded-br-md'
                      : 'text-gray-100 rounded-bl-md'
                  }`}
                  style={
                    msg.sender === 'bot'
                      ? { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }
                      : {}
                  }
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                />
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* WhatsApp escalation button (visible during escalation confirm) */}
          {escalation.step === 'confirm' && escalation.email && escalation.problemType && (
            <div className="px-4 pb-2">
              <button
                onClick={() => handleWhatsAppRedirect(escalation.email!, escalation.problemType!)}
                className="w-full py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:brightness-110"
                style={{ background: '#25D366' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Ouvrir WhatsApp
              </button>
            </div>
          )}

          {/* Input */}
          <div
            className="px-3 py-3 shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  escalation.active && escalation.step === 'email'
                    ? 'Ton email...'
                    : escalation.active && escalation.step === 'problem'
                    ? 'Décris ton problème...'
                    : 'Pose ta question...'
                }
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="p-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white disabled:opacity-30 hover:brightness-110 transition-all shrink-0"
                aria-label="Envoyer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-gray-600 text-[10px] mt-1.5">
              Propulsé par 318 LEGAACY · IA BPM
            </p>
          </div>
        </div>
      )}
    </>
  )
}
