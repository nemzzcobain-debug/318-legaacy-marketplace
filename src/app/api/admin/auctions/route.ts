export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status) where.status = status;

    const auctions = await prisma.auction.findMany({
      where,
      include: {
        beat: {
          select: { title: true, genre: true, coverImage: true, producer: { select: { name: true, displayName: true } } }
        },
        _count: { select: { bids: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(auctions);
  } catch (error) {
    console.error('Admin auctions error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    const { auctionId, status } = await req.json();
    if (!auctionId || !['CANCELLED', 'ACTIVE', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 });
    }

    const auction = await prisma.auction.update({
      where: { id: auctionId },
      data: { status },
      include: { beat: { select: { producerId: true, title: true } } }
    });

    await prisma.notification.create({
      data: {
        userId: auction.beat.producerId,
        type: 'SYSTEM',
        title: `Enchere ${status === 'CANCELLED' ? 'annulee' : 'modifiee'}`,
        message: `L'enchere pour "${auction.beat.title}" a ete ${status === 'CANCELLED' ? 'annulee' : 'mise a jour'} par l'administrateur.`
      }
    });

    return NextResponse.json(auction);
  } catch (error) {
    console.error('Admin auction update error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
