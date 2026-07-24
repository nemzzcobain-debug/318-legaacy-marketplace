type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'

type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type: AudioSessionType
  }
}

/**
 * Utilise la session média d'iOS 17+ pour que les beats restent audibles
 * lorsque le commutateur silencieux de l'iPhone est activé.
 */
export function configurePlaybackAudioSession() {
  if (typeof navigator === 'undefined') return

  const audioSession = (navigator as NavigatorWithAudioSession).audioSession
  if (!audioSession) return

  try {
    audioSession.type = 'playback'
  } catch {
    // Les navigateurs sans prise en charge conservent leur comportement normal.
  }
}
