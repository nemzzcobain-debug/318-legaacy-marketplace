export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
        bids: {
          include: {
            user: { select: { id: true, name: true, displayName: true, avatar: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        winner: {
          select: { name: true, displayName: true }
        }
      }
    });

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 });
    }

    return NextResponse.json(auction);
  } catch (error) {
    console.error('Auction detail error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
