export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/unsubscribe?token=xxx — Desabonne l'utilisateur des emails
 * Le token est unique par utilisateur, genere automatiquement.
 * Desactive uniquement les notifications email (le compte reste actif).
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')

    if (!token || token.length < 10) {
      return new NextResponse(unsubscribePage('Lien invalide', false), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const user = await prisma.user.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, notifEmail: true, email: true },
    })

    if (!user) {
      return new NextResponse(unsubscribePage('Lien invalide ou expire', false), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Desactiver toutes les notifications email
    await prisma.user.update({
      where: { id: user.id },
      data: {
        notifEmail: false,
        notifBid: false,
        notifMessage: false,
      },
    })

    return new NextResponse(unsubscribePage('Desabonnement confirme', true), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Erreur unsubscribe:', error)
    return new NextResponse(unsubscribePage('Erreur serveur', false), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

// Page HTML de confirmation
function unsubscribePage(message: string, success: boolean): string {
  const color = success ? '#2ed573' : '#e11d48'
  const icon = success ? '✓' : '✕'
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${message} - 318 LEGAACY</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:40px;max-width:400px;">
    <div style="width:60px;height:60px;border-radius:50%;background:${color}15;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
      <span style="font-size:28px;color:${color};">${icon}</span>
    </div>
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 12px;">${message}</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">
      ${success ? 'Vous ne recevrez plus d\'emails de 318 LEGAACY Marketplace. Vous pouvez reactiver les notifications dans les parametres de votre profil.' : 'Ce lien de desabonnement n\'est pas valide. Connectez-vous a votre compte pour gerer vos preferences email.'}
    </p>
    <a href="${process.env.NEXTAUTH_URL || 'https://www.318marketplace.com'}" style="display:inline-block;background:linear-gradient(135deg,#e11d48,#ff0033);color:#000;font-weight:700;font-size:14px;padding:12px 32px;border-radius:12px;text-decoration:none;">
      Retour au site
    </a>
  </div>
</body>
</html>`
}
