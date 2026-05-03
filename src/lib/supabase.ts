import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase côté serveur (Service Role Key)
 * Utilisé pour les uploads de fichiers et les opérations admin
 * Initialisation lazy pour ne pas crasher au démarrage si les vars ne sont pas définies
 */

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Variables Supabase manquantes. Ajouter NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env'
    )
  }

  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return _client
}

/**
 * Upload un fichier vers Supabase Storage
 * @param bucket - Nom du bucket (ex: 'beats', 'covers')
 * @param filePath - Chemin du fichier dans le bucket
 * @param fileData - Buffer du fichier
 * @param contentType - Type MIME du fichier
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  fileData: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient()

  const { error } = await client.storage
    .from(bucket)
    .upload(filePath, fileData, {
      contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Erreur upload Supabase (${bucket}/${filePath}): ${error.message}`)
  }

  return filePath
}

/**
 * Obtenir l'URL publique d'un fichier
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  const client = getClient()
  const { data } = client.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

/**
 * Generer une signed URL temporaire pour un fichier (download protege)
 * @param bucket - Nom du bucket
 * @param filePath - Chemin dans le bucket
 * @param expiresIn - Duree en secondes (defaut: 1h)
 */
export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const client = getClient()
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error(`Erreur signed URL (${bucket}/${filePath}):`, error.message)
      return null
    }
    return data.signedUrl
  } catch (err) {
    console.error('Erreur generation signed URL:', err)
    return null
  }
}

/**
 * Obtenir l'URL de streaming pour un fichier audio
 * Utilise l'URL publique directement (les buckets audio sont publics)
 * Plus fiable que les signed URLs qui peuvent expirer avec des clés perimees
 */
export function getStreamUrl(bucket: string, filePath: string): string {
  return getPublicUrl(bucket, filePath)
}

/**
 * Extraire le bucket et le path d'une URL publique Supabase
 * Ex: https://xxx.supabase.co/storage/v1/object/public/beats/file.mp3
 *   → { bucket: 'beats', path: 'file.mp3' }
 */
export function parseSupabaseUrl(url: string): { bucket: string; path: string } | null {
  try {
    // Format: /storage/v1/object/public/{bucket}/{path}
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) }
    return null
  } catch {
    return null
  }
}

/**
 * Supprimer un fichier de Supabase Storage
 */
export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  try {
    const client = getClient()
    const { error } = await client.storage.from(bucket).remove([filePath])
    if (error) {
      console.error(`Erreur suppression (${bucket}/${filePath}): ${error.message}`)
    }
  } catch (err) {
    console.error('Erreur suppression fichier:', err)
  }
}
