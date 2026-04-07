import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTOTP, generateBackupCodes } from '@/lib/two-factor'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      // @ts-ignore - twoFactorSecret/twoFactorEnabled fields exist in schema but not generated yet
      select: { id: true, twoFactorSecret: true, twoFactorEnabled: true }
    })

    if (!user || !(user as any)?.twoFactorSecret) {
      return NextResponse.json({ error: 'Configuration 2FA non trouvée' }, { status: 400 })
    }

    const isValid = verifyTOTP((user as any).twoFactorSecret, code)

    if (!isValid) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 400 })
    }

    // Enable 2FA and generate backup codes
    const backupCodes = generateBackupCodes()

    await prisma.user.update({
      where: { id: user!.id },
      // @ts-ignore - twoFactorEnabled field exists in schema but not generated yet
      data: { twoFactorEnabled: true }
    })

    return NextResponse.json({
      success: true,
      backupCodes,
      message: '2FA activé avec succès'
    })
  } catch (error) {
    console.error('2FA verify error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
