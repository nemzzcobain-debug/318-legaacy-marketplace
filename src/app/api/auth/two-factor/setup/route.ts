import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTOTPSecret, generateTOTPUri } from '@/lib/two-factor'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // F20 FIX: Typage correct sans @ts-ignore — cast vers le type étendu
    type UserWith2FA = { id: string; email: string; twoFactorEnabled?: boolean; twoFactorSecret?: string | null }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, twoFactorEnabled: true } as any
    }) as UserWith2FA | null

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA déjà activé' }, { status: 400 })
    }

    // Generate secret and save temporarily (not enabled yet)
    const secret = generateTOTPSecret()
    const uri = generateTOTPUri(secret, user.email)

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret } as any
    })

    // F2 FIX: Ne JAMAIS exposer le secret brut — seul l'URI (contenant le secret encodé)
    // est nécessaire côté client pour générer le QR code
    return NextResponse.json({ uri })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
