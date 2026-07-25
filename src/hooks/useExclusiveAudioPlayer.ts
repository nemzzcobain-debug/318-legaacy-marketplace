'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { configurePlaybackAudioSession } from '@/lib/audio/session'

/**
 * Lecteur HTMLAudio exclusif : une seule instance peut jouer à la fois.
 * Les jetons de requête empêchent un ancien play() asynchrone de redémarrer
 * après que l'utilisateur a déjà appuyé sur pause.
 */
export function useExclusiveAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingIdRef = useRef<string | null>(null)
  const requestTokenRef = useRef(0)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const releaseAudio = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return
    audio.onended = null
    audio.onerror = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }, [])

  const stop = useCallback(() => {
    requestTokenRef.current += 1
    const audio = audioRef.current
    audioRef.current = null
    playingIdRef.current = null
    releaseAudio(audio)
    setPlayingId(null)
  }, [releaseAudio])

  const togglePlay = useCallback(
    async (id: string, url: string) => {
      if (!url) return

      // Le ref est mis à jour immédiatement, contrairement au state React.
      // Un double appui rapide est donc traité comme play puis pause.
      if (playingIdRef.current === id) {
        stop()
        return
      }

      const token = requestTokenRef.current + 1
      requestTokenRef.current = token

      releaseAudio(audioRef.current)

      configurePlaybackAudioSession()
      const audio = new Audio(url)
      audio.preload = 'metadata'
      audioRef.current = audio
      playingIdRef.current = id
      setPlayingId(id)

      const clearIfCurrent = () => {
        if (requestTokenRef.current !== token || audioRef.current !== audio) return
        audioRef.current = null
        playingIdRef.current = null
        setPlayingId(null)
      }

      audio.onended = clearIfCurrent
      audio.onerror = clearIfCurrent

      try {
        await audio.play()

        // Une pause ou un changement de piste a pu arriver pendant play().
        if (requestTokenRef.current !== token || audioRef.current !== audio) {
          releaseAudio(audio)
        }
      } catch (error) {
        console.error('Erreur de lecture audio:', error)
        if (requestTokenRef.current === token && audioRef.current === audio) {
          releaseAudio(audio)
          clearIfCurrent()
        }
      }
    },
    [releaseAudio, stop]
  )

  useEffect(() => {
    return () => {
      requestTokenRef.current += 1
      releaseAudio(audioRef.current)
      audioRef.current = null
      playingIdRef.current = null
    }
  }, [releaseAudio])

  return { playingId, togglePlay, stop }
}
