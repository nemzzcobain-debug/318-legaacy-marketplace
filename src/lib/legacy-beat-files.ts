export type LegacyBeatFileType = 'mp3' | 'wav'

/**
 * Les premiers beats de la plateforme stockaient le fichier vendable dans
 * `audioUrl`. Les uploads récents utilisent `audioUrl` uniquement pour la
 * preview et placent les fichiers complets dans des champs privés dédiés.
 *
 * On n'accepte donc comme ancien fichier vendable que le bucket public
 * historique `beats`, jamais le bucket `beat-previews`.
 */
export function getLegacyBeatFileType(
  audioUrl: string | null | undefined
): LegacyBeatFileType | null {
  if (!audioUrl) return null

  try {
    const url = new URL(audioUrl)
    const path = decodeURIComponent(url.pathname).toLowerCase()
    const isLegacyPublicBeat = path.includes('/storage/v1/object/public/beats/')

    if (!isLegacyPublicBeat) return null
    if (path.endsWith('.mp3')) return 'mp3'
    if (path.endsWith('.wav') || path.endsWith('.wave')) return 'wav'
    return null
  } catch {
    return null
  }
}

export function getLegacyBeatFileUrl(
  audioUrl: string | null | undefined,
  requestedType: LegacyBeatFileType
): string | null {
  return getLegacyBeatFileType(audioUrl) === requestedType ? audioUrl || null : null
}
