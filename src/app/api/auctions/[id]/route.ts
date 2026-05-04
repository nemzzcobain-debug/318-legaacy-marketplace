export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // BUG FIX 3: Rendre l'enchère publique (données de base) mais protéger les details sensibles
    const session = await getServerSession(authOptions);
    const isAuthenticated = !!session?.user;

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        beat: {
          include: {
            producer: {
              select: { id: true, name: true, displayName: true, avatar: true, producerStatus: true, rating: true, totalSales: true }
            }
          }
        },
        // Bids et winner seulement pour les utilisateurs connectés
        ...(isAuthenticated ? {
          bids: {
            include: {
              user: { select: { id: true, name: true, displayName: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' as const },
            take: 20
          },
          winner: {
            select: { name: true, displayName: true }
          }
        } : {
          bids: {
            select: { id: true, amount: true, createdAt: true },
            orderBy: { createdAt: 'desc' as const },
            take: 5
          }
        }),
      }
    });

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 });
    }

    return NextResponse.json(auction);
  } catch (error) {
    console.error('Auction detail error:', String(error));
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
