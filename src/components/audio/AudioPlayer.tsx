'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Play, Pause, Volume2, VolumeX, SkipBack, Loader2 } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  title?: string
  producer?: string
  coverImage?: string
  isPlaying?: boolean
  onPlayToggle?: () => void
  compact?: boolean
  accentColor?: string
}

/**
 * AudioPlayer — utilise Web Audio API (AudioContext + AudioBufferSourceNode)
 * pour la lecture audio, plutot que l'element <audio>. Web Audio API est
 * plus tolerant aux fichiers WAV avec headers non strictement conformes
 * (qui sont typiques des exports DAW) et offre un controle plus fiable
 * de la lecture.
 */
export default function AudioPlayer({
  src,
  title,
  producer,
  coverImage,
  isPlaying: externalIsPlaying,
  onPlayToggle,
  compact = false,
  accentColor = '#e11d48',
}: AudioPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Web Audio refs — pas re-crees a chaque render
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  // Timestamp (dans le repere AudioContext) ou la lecture a demarre, pour
  // calculer le currentTime en temps reel.
  const startedAtCtxTimeRef = useRef<number>(0)
  // Offset dans le buffer ou reprendre la lecture apres un pause.
  const offsetRef = useRef<number>(0)
  const progressIntervalRef = useRef<number | null>(null)

  const [internalPlaying, setInternalPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [audioError, setAudioError] = useState(false)

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalPlaying

  // Cree (ou reutilise) le singleton AudioContext. iOS/Safari refusent de
  // creer ou resume l'AudioContext hors d'un user gesture — on le cree donc
  // de facon lazy au premier play().
  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AC()
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.gain.value = volume
      gainNodeRef.current.connect(audioContextRef.current.destination)
    }
    return audioContextRef.current
  }, [volume])

  // Fetch + decode l'audio une fois par src.
  useEffect(() => {
    if (!src) return
    let cancelled = false
    setLoading(true)
    setAudioError(false)
    setCurrentTime(0)
    setDuration(0)
    offsetRef.current = 0
    ;(async () => {
      try {
        // Pour les blob: URLs, on utilise XMLHttpRequest comme fallback
        // car fetch() peut etre bloque par CSP connect-src
        let buf: ArrayBuffer
        if (src.startsWith('blob:')) {
          buf = await new Promise<ArrayBuffer>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('GET', src)
            xhr.responseType = 'arraybuffer'
            xhr.onload = () => resolve(xhr.response)
            xhr.onerror = () => reject(new Error('XHR failed for blob'))
            xhr.send()
          })
        } else {
          const res = await fetch(src)
          if (!res.ok) throw new Error('fetch ' + res.status)
          buf = await res.arrayBuffer()
        }
        if (cancelled) return
        const ctx = getContext()
        const decoded = await ctx.decodeAudioData(buf)
        if (cancelled) return
        audioBufferRef.current = decoded
        setDuration(decoded.duration)
        setLoading(false)
        // Calcule la waveform depuis les donnees decodees (plus efficace
        // que de refetch).
        const rawData = decoded.getChannelData(0)
        const samples = compact ? 60 : 100
        const blockSize = Math.floor(rawData.length / samples)
        const filteredData: number[] = []
        for (let i = 0; i < samples; i++) {
          let sum = 0
          for (let j = 0; j < blockSize; j++) sum += Math.abs(rawData[i * blockSize + j])
          filteredData.push(sum / blockSize)
        }
        const maxVal = Math.max(...filteredData)
        const normalized = maxVal > 0 ? filteredData.map((d) => d / maxVal) : filteredData
        if (!cancelled) setWaveformData(normalized)
      } catch (e) {
        console.error('Audio decode failed:', e)
        if (!cancelled) {
          setAudioError(true)
          setLoading(false)
          const samples = compact ? 60 : 100
          setWaveformData(Array.from({ length: samples }, () => 0.2 + Math.random() * 0.8))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [src, compact, getContext])

  // Cleanup final a l'unmount : stop, disconnect, close context.
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {}
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx2d.scale(dpr, dpr)
    const width = rect.width
    const height = rect.height
    const barWidth = width / waveformData.length
    const gap = 1
    const progress = duration > 0 ? currentTime / duration : 0
    ctx2d.clearRect(0, 0, width, height)
    waveformData.forEach((val, i) => {
      const barHeight = val * height * 0.85
      const x = i * barWidth
      const y = (height - barHeight) / 2
      const isPlayed = i / waveformData.length <= progress
      ctx2d.fillStyle = isPlayed ? accentColor : 'rgba(255, 255, 255, 0.15)'
      ctx2d.beginPath()
      ctx2d.roundRect(x + gap / 2, y, barWidth - gap, barHeight, 1)
      ctx2d.fill()
    })
  }, [waveformData, currentTime, duration, accentColor])

  const stopSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null
        sourceNodeRef.current.stop()
      } catch {}
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const startFrom = useCallback(
    (offsetSec: number) => {
      const buffer = audioBufferRef.current
      const ctx = audioContextRef.current
      const gain = gainNodeRef.current
      if (!buffer || !ctx || !gain) return

      // AudioContext peut etre suspendu initialement sur certains navigateurs.
      // On le reprend apres le user gesture (le click du user).
      if (ctx.state === 'suspended') ctx.resume()

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(gain)

      // Callback quand la lecture est finie naturellement
      source.onended = () => {
        if (sourceNodeRef.current === source) {
          stopSource()
          offsetRef.current = 0
          setCurrentTime(0)
          if (onPlayToggle) onPlayToggle()
          else setInternalPlaying(false)
        }
      }

      source.start(0, offsetSec)
      sourceNodeRef.current = source
      startedAtCtxTimeRef.current = ctx.currentTime - offsetSec
      offsetRef.current = offsetSec

      // Track progress every 100ms
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = window.setInterval(() => {
        const c = audioContextRef.current
        if (!c) return
        const t = c.currentTime - startedAtCtxTimeRef.current
        setCurrentTime(Math.min(t, buffer.duration))
      }, 100)
    },
    [stopSource, onPlayToggle]
  )

  // Sync avec l'etat isPlaying externe
  useEffect(() => {
    if (audioError || !audioBufferRef.current) return
    if (isPlaying) {
      // Demarrer depuis l'offset sauvegarde
      startFrom(offsetRef.current)
    } else {
      // Pause : sauvegarder l'offset courant et stopper
      const ctx = audioContextRef.current
      if (ctx && sourceNodeRef.current) {
        offsetRef.current = ctx.currentTime - startedAtCtxTimeRef.current
      }
      stopSource()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, audioBufferRef.current, audioError])

  // Volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : volume
    }
  }, [volume, muted])

  const togglePlay = () => {
    if (audioError || !audioBufferRef.current) return
    if (onPlayToggle) onPlayToggle()
    else setInternalPlaying(!internalPlaying)
  }

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const buffer = audioBufferRef.current
    if (!canvas || !buffer) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    const newOffset = progress * buffer.duration
    offsetRef.current = newOffset
    setCurrentTime(newOffset)
    if (isPlaying) {
      stopSource()
      startFrom(newOffset)
    }
  }

  const restart = () => {
    offsetRef.current = 0
    setCurrentTime(0)
    if (isPlaying) {
      stopSource()
      startFrom(0)
    }
  }

  const formatTime = (t: number) => {
    if (!t || isNaN(t) || !isFinite(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Compact mode (for cards & upload preview)
  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={audioError}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: audioError ? '#666' : accentColor }}
            aria-label={isPlaying ? 'Arrêter la lecture' : 'Lire le beat'}
            aria-pressed={isPlaying}
          >
            {loading && !audioError ? (
              <Loader2 size={14} className="text-black animate-spin" />
            ) : isPlaying ? (
              <Pause size={14} className="text-black" />
            ) : (
              <Play size={14} className="text-black ml-0.5" />
            )}
          </button>
          <canvas
            ref={canvasRef}
            className="flex-1 h-8 cursor-pointer"
            onClick={handleWaveformClick}
            style={{ width: '100%' }}
            role="slider"
            aria-label="Barre de progression audio"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          />
          <span className="text-[10px] text-gray-400 flex-shrink-0 w-8 text-right">
            {audioError ? 'ERR' : formatTime(duration - currentTime)}
          </span>
        </div>
        {audioError && (
          <p className="text-[10px] text-red-400 mt-1">Impossible de lire ce fichier audio</p>
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
      {(title || coverImage) && (
        <div className="flex items-center gap-3 p-4 pb-2">
          {coverImage && (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 relative">
              <Image
                src={coverImage}
                alt={title || 'Beat cover'}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && <p className="text-sm font-bold text-white truncate">{title}</p>}
            {producer && <p className="text-xs text-gray-400 truncate">{producer}</p>}
          </div>
        </div>
      )}

      <div className="px-4 py-2">
        <canvas
          ref={canvasRef}
          className="w-full h-16 cursor-pointer rounded-lg"
          onClick={handleWaveformClick}
        />
      </div>

      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={restart}
            className="text-gray-400 hover:text-white transition p-1"
            aria-label="Recommencer la lecture"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            disabled={audioError}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-50"
            style={{ backgroundColor: audioError ? '#666' : accentColor }}
            aria-label={isPlaying ? 'Arrêter la lecture' : 'Lire le beat'}
            aria-pressed={isPlaying}
          >
            {loading && !audioError ? (
              <Loader2 size={18} className="text-black animate-spin" />
            ) : isPlaying ? (
              <Pause size={18} className="text-black" />
            ) : (
              <Play size={18} className="text-black ml-0.5" />
            )}
          </button>
        </div>

        <div className="text-xs text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            className="text-gray-400 hover:text-white transition"
            aria-label={muted ? 'Activer le son' : 'Mute'}
          >
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value))
              setMuted(false)
            }}
            className="w-16 h-1 accent-[#e11d48] cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
      {audioError && (
        <p className="text-xs text-red-400 text-center pb-3">Impossible de lire ce fichier audio</p>
      )}
    </div>
  )
}
