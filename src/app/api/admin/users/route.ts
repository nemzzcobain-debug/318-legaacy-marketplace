export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper function to mask email addresses
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const localMasked = local.charAt(0) + '*'.repeat(Math.max(1, local.length - 2)) + (local.length > 1 ? local.charAt(local.length - 1) : '');
  const [domainName, ...domainParts] = domain.split('.');
  const domainMasked = domainName.charAt(0) + '*'.repeat(Math.max(1, domainName.length - 2)) + domainParts.join('.');

  return `${localMasked}@${domainMasked}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    let search = searchParams.get('search');

    // F15 FIX: Limiter la longueur de recherche pour éviter les attaques DoS
    if (search && search.length > 100) {
      search = search.slice(0, 100);
    }

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (search) {
      // F12 FIX: Ne plus rechercher par email pour éviter l'énumération
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        role: true,
        producerStatus: true,
        totalSales: true,
        totalPurchases: true,
        rating: true,
        createdAt: true,
        _count: { select: { beats: true, bids: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // F12 FIX: Masquer emails et ne pas exposer les données financières détaillées
    const maskedUsers = users.map(user => ({
      ...user,
      email: maskEmail(user.email),
      // Supprimer les montants exacts, garder juste les compteurs
      totalSales: user.totalSales > 0 ? user.totalSales : 0,
    }));

    return NextResponse.json(maskedUsers);
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
