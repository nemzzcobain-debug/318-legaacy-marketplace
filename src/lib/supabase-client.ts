import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase côté navigateur (anon key)
 * Utilisé pour les abonnements Realtime (enchères en direct)
 */

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn('Variables Supabase client manquantes — le temps réel sera désactivé')
    // Retourner un client factice qui ne crashe pas
    return createClient('https://placeholder.supabase.co', 'placeholder')
  }

  _client = createClient(url, key, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })

  return _client
}

// Export lazy — ne pas appeler getSupabaseClient() au top level pour éviter crash au build
export default { getSupabaseClient }
