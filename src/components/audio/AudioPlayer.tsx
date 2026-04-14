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
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [internalPlaying, setInternalPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [audioError, setAudioError] = useState(false)

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalPlaying

  // crossOrigin ne doit PAS etre defini pour les blob: ou data: URLs
  // (fichiers locaux utilises pour l'apercu avant upload) car cela cause
  // l'evenement "error" dans Chrome sur macOS et bloque la lecture.
  const isLocalUrl = src?.startsWith('blob:') || src?.startsWith('data:')

  // Generate waveform from audio - with size limit to prevent memory issues
  const generateWaveform = useCallback(async () => {
    if (!src) return
    try {
      const response = await fetch(src)
      const arrayBuffer = await response.arrayBuffer()

      // Skip decode for files > 20MB to avoid memory/crash issues
      if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
        const samples = compact ? 60 : 100
        const fake = Array.from(
          { length: samples },
          (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 0.3)) + Math.random() * 0.2
        )
        setWaveformData(fake)
        return
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const rawData = audioBuffer.getChannelData(0)

      const samples = compact ? 60 : 100
      const blockSize = Math.floor(rawData.length / samples)
      const filteredData: number[] = []

      for (let i = 0; i < samples; i++) {
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j])
        }
        filteredData.push(sum / blockSize)
      }

      const maxVal = Math.max(...filteredData)
      const normalized = maxVal > 0 ? filteredData.map((d) => d / maxVal) : filteredData
      setWaveformData(normalized)
      audioContext.close()
    } catch (err) {
      console.warn('Waveform generation failed, using fallback:', err)
      const samples = compact ? 60 : 100
      const fake = Array.from({ length: samples }, () => 0.2 + Math.random() * 0.8)
      setWaveformData(fake)
    }
  }, [src, compact])

  useEffect(() => {
    generateWaveform()
  }, [generateWaveform])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const barWidth = width / waveformData.length
    const gap = 1
    const progress = duration > 0 ? currentTime / duration : 0

    ctx.clearRect(0, 0, width, height)

    waveformData.forEach((val, i) => {
      const barHeight = val * height * 0.85
      const x = i * barWidth
      const y = (height - barHeight) / 2
      const isPlayed = i / waveformData.length <= progress

      ctx.fillStyle = isPlayed ? accentColor : 'rgba(255, 255, 255, 0.15)'
      ctx.beginPath()
      ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, 1)
      ctx.fill()
    })
  }, [waveformData, currentTime, duration, accentColor])

  // Audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => {
      setDuration(audio.duration)
    }
    const onCanPlay = () => {
      setLoading(false)
      setAudioError(false)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      if (onPlayToggle) {
        onPlayToggle()
      } else {
        setInternalPlaying(false)
      }
    }
    const onError = () => {
      // Pour les blob: URLs (apercu avant upload), Chrome sur macOS declenche
      // parfois un event "error" transitoire (ex: lecture concurrente du File
      // pendant l'upload vers Supabase). On ignore silencieusement ces erreurs
      // — l'apercu n'est pas critique, et le message rouge inquietait le user.
      if (src?.startsWith('blob:') || src?.startsWith('data:')) {
        setLoading(false)
        // Retry une fois au cas ou c'est transitoire
        if (audio.dataset.retried !== 'true') {
          audio.dataset.retried = 'true'
          setTimeout(() => audio.load(), 200)
        }
        return
      }
      setAudioError(true)
      setLoading(false)
      console.error('Audio loading error for:', src)
    }
    const onWaiting = () => setLoading(true)
    const onPlaying = () => setLoading(false)

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
    }
  }, [onPlayToggle, src])

  // Sync play state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      // Si l'audio n'est pas encore pret, attendre le canplay avant de play()
      // Evite les echecs silencieux qui fermaient l'AudioPlayer completement.
      const tryPlay = () => {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Audio play failed:', err.message, err.name)
            // Ne PAS appeler onPlayToggle ici : cela demonte l'AudioPlayer
            // avant meme que l'utilisateur puisse voir ce qui se passe.
            // On laisse juste l'utilisateur recliquer sur play si besoin.
            setInternalPlaying(false)
          })
        }
      }

      if (audio.readyState >= 2) {
        // HAVE_CURRENT_DATA ou mieux : on peut jouer
        tryPlay()
      } else {
        // Pas encore pret : attendre l'event canplay
        const onCanPlayOnce = () => {
          audio.removeEventListener('canplay', onCanPlayOnce)
          tryPlay()
        }
        audio.addEventListener('canplay', onCanPlayOnce)
        // Force le chargement
        if (audio.networkState === 3 || audio.networkState === 0) {
          audio.load()
        }
        return () => audio.removeEventListener('canplay', onCanPlayOnce)
      }
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume
    }
  }, [volume, muted])

  const togglePlay = () => {
    if (audioError) return
    if (onPlayToggle) {
      onPlayToggle()
    } else {
      setInternalPlaying(!internalPlaying)
    }
  }

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const audio = audioRef.current
    if (!canvas || !audio || !duration) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    audio.currentTime = progress * duration
  }

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
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
        <audio ref={audioRef} src={src} preload="auto" />
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
        {audioError && !isLocalUrl && (
          <p className="text-[10px] text-red-400 mt-1">Impossible de lire ce fichier audio</p>
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
      <audio ref={audioRef} src={src} preload="auto" />

      {/* Top section with cover + info */}
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

      {/* Waveform */}
      <div className="px-4 py-2">
        <canvas
          ref={canvasRef}
          className="w-full h-16 cursor-pointer rounded-lg"
          onClick={handleWaveformClick}
        />
      </div>

      {/* Controls */}
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

        {/* Time */}
        <div className="text-xs text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Volume */}
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
      {audioError && !isLocalUrl && (
        <p className="text-xs text-red-400 text-center pb-3">Impossible de lire ce fichier audio</p>
      )}
    </div>
  )
}
