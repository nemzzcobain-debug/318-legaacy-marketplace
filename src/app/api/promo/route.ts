export const dynamic = 'force-dynamic'

// ─── 318 LEGAACY Marketplace - Promo Codes API ───
// POST /api/promo — Valider un code promo
// GET /api/promo — Lister les codes promo (admin)
// PUT /api/promo — Créer un code promo (admin)
// PATCH /api/promo — Modifier un code promo (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Rate limiting for promo code attempts ───
const promoRateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkPromoRateLimit(ip: string, maxAttempts: number = 5, windowMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now()
  const entry = promoRateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    promoRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (entry.count < maxAttempts) {
    entry.count++
    return true
  }

  return false
}

// ─── POST: Valider un code promo ───
export async function POST(req: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    // Check promo code rate limit (5 attempts per 5 minutes)
    if (!checkPromoRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Trop de tentatives de code promo. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': '300' } }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { code, auctionId, price } = await req.json()

    if (!code || !auctionId || !price) {
      return NextResponse.json({ error: 'Code, auctionId et prix requis' }, { status: 400 })
    }

    // Trouver le code promo
    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    })

    if (!promo) {
      return NextResponse.json({ error: 'Code promo invalide' }, { status: 404 })
    }

    // Vérifications
    if (promo.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Ce code promo n\'est plus actif' }, { status: 400 })
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Ce code promo a expiré' }, { status: 400 })
    }

    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
      return NextResponse.json({ error: 'Ce code promo a atteint sa limite d\'utilisation' }, { status: 400 })
    }

    if (promo.minPrice && price < promo.minPrice) {
      return NextResponse.json({ error: `Prix minimum de ${promo.minPrice}€ requis` }, { status: 400 })
    }

    // Vérifier si déjà utilisé par cet user pour cette enchère
    const alreadyUsed = await prisma.promoUsage.findUnique({
      where: {
        promoCodeId_userId_auctionId: {
          promoCodeId: promo.id,
          userId: session.user.id,
          auctionId,
        },
      },
    })

    if (alreadyUsed) {
      return NextResponse.json({ error: 'Code déjà utilisé pour cette enchère' }, { status: 409 })
    }

    // Calculer la réduction
    let discount = 0
    if (promo.type === 'PERCENTAGE') {
      discount = Math.round((price * promo.value / 100) * 100) / 100
    } else {
      discount = Math.min(promo.value, price) // FIXED: ne pas dépasser le prix
    }

    const finalPrice = Math.max(0, Math.round((price - discount) * 100) / 100)

    return NextResponse.json({
      valid: true,
      promoId: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount,
      originalPrice: price,
      finalPrice,
    })
  } catch (error) {
    console.error('Promo validation error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── GET: Lister les codes promo (admin) ───
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const promos = await prisma.promoCode.findMany({
      include: {
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(promos)
  } catch (error) {
    console.error('Promo GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── PUT: Créer un code promo (admin) ───
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { code, type, value, minPrice, maxUses, expiresAt } = await req.json()

    if (!code || !value) {
      return NextResponse.json({ error: 'Code et valeur requis' }, { status: 400 })
    }

    // Vérifier unicité
    const existing = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 409 })
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase().trim(),
        type: type || 'PERCENTAGE',
        value: Number(value),
        minPrice: minPrice ? Number(minPrice) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json({ message: 'Code promo créé', promo }, { status: 201 })
  } catch (error) {
    console.error('Promo PUT error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── PATCH: Modifier un code promo (admin) ───
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { promoId, status, maxUses, expiresAt } = await req.json()

    if (!promoId) {
      return NextResponse.json({ error: 'promoId requis' }, { status: 400 })
    }

    const promo = await prisma.promoCode.update({
      where: { id: promoId },
      data: {
        ...(status && { status }),
        ...(maxUses !== undefined && { maxUses: maxUses ? Number(maxUses) : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    })

    return NextResponse.json({ message: 'Code promo mis à jour', promo })
  } catch (error) {
    console.error('Promo PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
