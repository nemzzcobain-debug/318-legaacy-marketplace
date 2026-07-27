import { describe, expect, it } from 'vitest'
import { getLegacyBeatFileType, getLegacyBeatFileUrl } from '@/lib/legacy-beat-files'

describe('legacy beat files', () => {
  it('reconnaît un ancien fichier MP3 vendable', () => {
    const url =
      'https://example.supabase.co/storage/v1/object/public/beats/producer/ancien-beat.mp3'

    expect(getLegacyBeatFileType(url)).toBe('mp3')
    expect(getLegacyBeatFileUrl(url, 'mp3')).toBe(url)
    expect(getLegacyBeatFileUrl(url, 'wav')).toBeNull()
  })

  it('reconnaît un ancien fichier WAV vendable', () => {
    const url =
      'https://example.supabase.co/storage/v1/object/public/beats/producer/ancien-beat.WAV'

    expect(getLegacyBeatFileType(url)).toBe('wav')
    expect(getLegacyBeatFileUrl(url, 'wav')).toBe(url)
  })

  it('ne traite jamais une preview comme un fichier vendable', () => {
    const preview =
      'https://example.supabase.co/storage/v1/object/public/beat-previews/producer/preview.wav'

    expect(getLegacyBeatFileType(preview)).toBeNull()
    expect(getLegacyBeatFileUrl(preview, 'wav')).toBeNull()
  })

  it('refuse les URL invalides ou les formats inconnus', () => {
    expect(getLegacyBeatFileType('not-an-url')).toBeNull()
    expect(
      getLegacyBeatFileType(
        'https://example.supabase.co/storage/v1/object/public/beats/producer/archive.zip'
      )
    ).toBeNull()
  })
})
