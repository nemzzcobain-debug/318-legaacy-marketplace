import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * F9 FIX: Helper centralisé pour extraire le userId de la session
 * Remplace les patterns `(session.user as any).id` dispersés dans le code
 */
export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  return {
    id: (session.user as { id?: string }).id || '',
    email: session.user.email || '',
    name: session.user.name || '',
    role: (session.user as { role?: string }).role || 'ARTIST',
  }
}

/**
 * Retourne le userId ou null si non authentifié
 */
export async function getAuthUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser()
  return user?.id || null
}
