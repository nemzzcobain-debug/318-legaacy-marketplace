export const AUDIO_PREVIEW_DURATION_SECONDS = 60

interface AudioPreviewResult {
  file: File
  sourceDuration: number
  previewDuration: number
}

/**
 * Crée localement un WAV limité aux 60 premières secondes.
 * Le fichier original ne transite pas par Vercel : il reste envoyé directement
 * vers le stockage privé Supabase.
 */
export async function createAudioPreview(sourceFile: File): Promise<AudioPreviewResult> {
  const AudioContextClass =
    window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext

  const context = new AudioContextClass()

  try {
    const sourceBuffer = await sourceFile.arrayBuffer()
    const decoded = await context.decodeAudioData(sourceBuffer)
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new Error('Impossible de lire la durée du fichier audio.')
    }

    const previewDuration = Math.min(decoded.duration, AUDIO_PREVIEW_DURATION_SECONDS)
    const channelCount = Math.min(decoded.numberOfChannels, 2)
    const sampleRate = 44100
    const frameCount = Math.ceil(previewDuration * sampleRate)
    const offlineContext = new OfflineAudioContext(channelCount, frameCount, sampleRate)
    const source = offlineContext.createBufferSource()
    source.buffer = decoded
    source.connect(offlineContext.destination)
    source.start(0, 0, previewDuration)
    const rendered = await offlineContext.startRendering()
    const wavBuffer = encodePcm16Wav(rendered, rendered.length, channelCount)
    const baseName = sourceFile.name.replace(/\.[^/.]+$/, '')

    return {
      file: new File([wavBuffer], `${baseName}-preview-60s.wav`, { type: 'audio/wav' }),
      sourceDuration: decoded.duration,
      previewDuration,
    }
  } finally {
    await context.close().catch(() => {})
  }
}

function encodePcm16Wav(
  audioBuffer: AudioBuffer,
  frameCount: number,
  channelCount: number
): ArrayBuffer {
  const bytesPerSample = 2
  const dataSize = frameCount * channelCount * bytesPerSample
  const output = new ArrayBuffer(44 + dataSize)
  const view = new DataView(output)
  const channels = Array.from({ length: channelCount }, (_, index) =>
    audioBuffer.getChannelData(index)
  )

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, audioBuffer.sampleRate, true)
  view.setUint32(28, audioBuffer.sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(32, channelCount * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame] || 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }

  return output
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
