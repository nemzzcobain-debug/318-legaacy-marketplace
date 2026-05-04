export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const [
      totalUsers,
      totalProducers,
      pendingProducers,
      totalBeats,
      totalAuctions,
      activeAuctions,
      totalBids,
      completedAuctions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'PRODUCER' } }),
      prisma.user.count({ where: { role: 'PRODUCER', producerStatus: 'PENDING' } }),
      prisma.beat.count(),
      prisma.auction.count(),
      prisma.auction.count({ where: { status: 'ACTIVE' } }),
      prisma.bid.count(),
      prisma.auction.findMany({
        where: { status: 'COMPLETED', commissionAmount: { not: null } },
        select: { commissionAmount: true, finalPrice: true }
      })
    ]);

    const platformRevenue = completedAuctions.reduce(
      (sum, a) => sum + (a.commissionAmount || 0), 0
    );
    const totalSalesVolume = completedAuctions.reduce(
      (sum, a) => sum + (a.finalPrice || 0), 0
    );

    return NextResponse.json({
      totalUsers,
      totalProducers,
      pendingProducers,
      totalBeats,
      totalAuctions,
      activeAuctions,
      totalBids,
      platformRevenue,
      totalSalesVolume,
      completedAuctionsCount: completedAuctions.length
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
