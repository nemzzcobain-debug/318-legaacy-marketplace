const PRIVATE_BEAT_FILE_KEYS = [
  'audioOriginal',
  'audioWav',
  'stemsUrl',
  'stemsFiles',
] as const

type PrivateBeatFileKey = (typeof PRIVATE_BEAT_FILE_KEYS)[number]

/**
 * Retire les emplacements des fichiers complets avant toute réponse publique.
 * L'aperçu `audioUrl` reste disponible pour le lecteur.
 */
export function withoutPrivateBeatFiles<T extends object>(beat: T): Omit<T, PrivateBeatFileKey> {
  const safeBeat = { ...beat } as Record<string, unknown>
  PRIVATE_BEAT_FILE_KEYS.forEach((key) => {
    delete safeBeat[key]
  })
  return safeBeat as Omit<T, PrivateBeatFileKey>
}

export function withoutPrivateAuctionFiles<T extends { beat: object }>(
  auction: T
): Omit<T, 'beat'> & { beat: Omit<T['beat'], PrivateBeatFileKey> } {
  return {
    ...auction,
    beat: withoutPrivateBeatFiles(auction.beat),
  }
}
