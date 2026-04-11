'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Sparkles, Loader2, RefreshCw, Check, X, Wand2 } from 'lucide-react'

const STYLES = [
  { id: 'abstract', label: 'Abstract', emoji: '🎨' },
  { id: 'dark', label: 'Dark', emoji: '🌑' },
  { id: 'neon', label: 'Neon', emoji: '💜' },
  { id: 'minimal', label: 'Minimal', emoji: '⬜' },
  { id: 'vintage', label: 'Vintage', emoji: '📼' },
  { id: 'futuristic', label: 'Futuristic', emoji: '🚀' },
  { id: 'street', label: 'Street', emoji: '🏙️' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
] as const

interface CoverGeneratorProps {
  onSelect: (imageUrl: string) => void
  onCancel: () => void
}

export default function CoverGenerator({ onSelect, onCancel }: CoverGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<string>('abstract')
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      setError('Décris ta cover en quelques mots')
      return
    }

    setGenerating(true)
    setError('')
    setGeneratedUrl(null)

    try {
      const res = await fetch('/api/ai/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), style }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la génération')
        return
      }

      setGeneratedUrl(data.imageUrl)
    } catch {
      setError('Erreur de connexion')
    } finally {
      setGenerating(false)
    }
  }

  const handleUse = () => {
    if (generatedUrl) {
      onSelect(generatedUrl)
    }
  }

  return (
    <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Wand2 size={16} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Générateur de Cover IA</h3>
            <p className="text-[10px] text-gray-500">Propulsé par DALL·E 3</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-white transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Prompt Input */}
      <div>
        <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Décris ta cover</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: un loup solitaire dans une forêt sombre avec de la brume violette..."
          rows={2}
          maxLength={500}
          disabled={generating}
          className="w-full bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm outline-none focus:border-purple-500/40 transition resize-none disabled:opacity-50"
        />
        <div className="text-right text-[10px] text-gray-600 mt-0.5">{prompt.length}/500</div>
      </div>

      {/* Style Selection */}
      <div>
        <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Style visuel</label>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              disabled={generating}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                style === s.id
                  ? 'text-purple-300 bg-purple-500/15 border-purple-500/30'
                  : 'text-gray-400 bg-white/[0.02] border-[#1e1e2e] hover:text-white hover:border-white/10'
              } disabled:opacity-50`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] bg-gradient-to-r from-purple-600 to-pink-600 text-white"
      >
        {generating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Génération en cours... (~15s)
          </>
        ) : generatedUrl ? (
          <>
            <RefreshCw size={16} />
            Regénérer
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Générer la cover
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Preview */}
      {generatedUrl && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-[#1e1e2e]">
            <Image
              src={generatedUrl}
              alt="Cover générée par IA"
              width={512}
              height={512}
              className="w-full aspect-square object-cover"
              unoptimized
            />
            <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm">
              <span className="text-[10px] text-purple-300 font-semibold">IA</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUse}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] bg-gradient-to-r from-green-600 to-emerald-600 text-white"
          >
            <Check size={16} />
            Utiliser cette cover
          </button>
        </div>
      )}
    </div>
  )
}
