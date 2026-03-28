'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioState {
  isPlaying: boolean
  currentTime: number
  duration: number
  progress: number
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
  })

  // Initialiser l'element audio une seule fois
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('timeupdate', () => {
        const audio = audioRef.current!
        setState((prev) => ({
          ...prev,
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
          progress: audio.duration ? (audio.currentTime / audio.duration) * 100 : 0,
        }))
      })
      audioRef.current.addEventListener('ended', () => {
        setState((prev) => ({ ...prev, isPlaying: false }))
        setCurrentTrackId(null)
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const play = useCallback((trackId: string, audioUrl: string) => {
    const audio = audioRef.current
    if (!audio) return

    if (currentTrackId === trackId) {
      // Toggle play/pause
      if (state.isPlaying) {
        audio.pause()
        setState((prev) => ({ ...prev, isPlaying: false }))
      } else {
        audio.play()
        setState((prev) => ({ ...prev, isPlaying: true }))
      }
    } else {
      // Nouveau track
      audio.src = audioUrl
      audio.play()
      setCurrentTrackId(trackId)
      setState((prev) => ({ ...prev, isPlaying: true, currentTime: 0, progress: 0 }))
    }
  }, [currentTrackId, state.isPlaying])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setState((prev) => ({ ...prev, isPlaying: false }))
  }, [])

  const seek = useCallback((percent: number) => {
    const audio = audioRef.current
    if (audio && audio.duration) {
      audio.currentTime = (percent / 100) * audio.duration
    }
  }, [])

  return {
    currentTrackId,
    ...state,
    play,
    pause,
    seek,
  }
}
