'use client'

import { useState, useRef, useEffect } from 'react'
import { Flag, X, AlertTriangle, Loader2 } from 'lucide-react'

interface ReportButtonProps {
  type: 'BEAT' | 'AUCTION' | 'USER' | 'MESSAGE'
  targetUserId?: string
  targetAuctionId?: string
  targetBeatId?: string
  size?: 'sm' | 'md'
}

const REASONS = [
  { value: 'SPAM', label: 'Spam', icon: '🚫' },
  { value: 'INAPPROPRIATE', label: 'Contenu inapproprié', icon: '⚠️' },
  { value: 'FRAUD', label: 'Fraude / Arnaque', icon: '🔒' },
  { value: 'COPYRIGHT', label: 'Violation de droits d\'auteur', icon: '©️' },
  { value: 'OTHER', label: 'Autre raison', icon: '📝' },
]

export default function ReportButton({
  type,
  targetUserId,
  targetAuctionId,
  targetBeatId,
  size = 'sm',
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'reason' | 'details' | 'done'>('reason')
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  function handleClose() {
    setIsOpen(false)
    setStep('reason')
    setSelectedReason('')
    setDescription('')
    setError('')
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          reason: selectedReason,
          description: description || undefined,
          targetUserId,
          targetAuctionId,
          targetBeatId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors du signalement')
        return
      }

      setStep('done')
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const btnSize = size === 'sm' ? 'p-2' : 'p-2.5'
  const iconSize = size === 'sm' ? 16 : 20

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`${btnSize} text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all`}
        title="Signaler"
      >
        <Flag size={iconSize} />
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={20} />
                <h3 className="font-semibold text-white">
                  {step === 'done' ? 'Merci !' : 'Signaler'}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-zinc-700 rounded-lg transition"
              >
                <X size={18} className="text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Step 1: Choose reason */}
              {step === 'reason' && (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400 mb-3">
                    Pourquoi signalez-vous ce contenu ?
                  </p>
                  {REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setSelectedReason(r.value)
                        setStep('details')
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all text-left"
                    >
                      <span className="text-lg">{r.icon}</span>
                      <span className="text-white text-sm font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Add details */}
              {step === 'details' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                    <span className="text-lg">
                      {REASONS.find((r) => r.value === selectedReason)?.icon}
                    </span>
                    <span className="text-sm text-zinc-300">
                      {REASONS.find((r) => r.value === selectedReason)?.label}
                    </span>
                    <button
                      onClick={() => setStep('reason')}
                      className="ml-auto text-xs text-purple-400 hover:text-purple-300"
                    >
                      Changer
                    </button>
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Détails supplémentaires (optionnel)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décrivez le problème..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-zinc-500 mt-1 text-right">
                      {description.length}/500
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        'Envoyer le signalement'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {step === 'done' && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <h4 className="text-white font-semibold mb-2">
                    Signalement envoyé
                  </h4>
                  <p className="text-sm text-zinc-400 mb-4">
                    Notre équipe va examiner votre signalement dans les plus brefs délais.
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
