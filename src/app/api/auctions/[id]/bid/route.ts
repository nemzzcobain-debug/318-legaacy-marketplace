import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const LICENSE_MULTIPLIERS: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2.5,
  EXCLUSIVE: 10,
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non connecte' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' }
    });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const { amount, licenseType = 'BASIC' } = await req.json();

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: { beat: { select: { producerId: true } } }
    });

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 });
    }

    // Validations
    if (auction.status !== 'ACTIVE' && auction.status !== 'ENDING_SOON') {
      return NextResponse.json({ error: 'Cette enchere n\'est plus active' }, { status: 400 });
    }

    if (new Date(auction.endTime) < new Date()) {
      return NextResponse.json({ error: 'Cette enchere est terminee' }, { status: 400 });
    }

    if (auction.beat.producerId === user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas encherir sur votre propre beat' }, { status: 400 });
    }

    const minBid = auction.currentBid + auction.bidIncrement;
    if (amount < minBid) {
      return NextResponse.json({ error: `L'enchere minimum est de ${minBid} EUR` }, { status: 400 });
    }

    // Calculate final amount with license multiplier
    const multiplier = LICENSE_MULTIPLIERS[licenseType] || 1;
    const finalAmount = amount * multiplier;

    // Create bid
    const bid = await prisma.bid.create({
      data: {
        amount,
        licenseType,
        finalAmount,
        auctionId: auction.id,
        userId: user.id,
      },
      include: {
        user: { select: { name: true, displayName: true } }
      }
    });

    // Anti-snipe: extend auction if less than 2 minutes remaining
    const now = new Date();
    const endTime = new Date(auction.endTime);
    const timeLeft = (endTime.getTime() - now.getTime()) / 60000; // in minutes

    let newEndTime = auction.endTime;
    let antiSnipeTriggered = false;

    if (timeLeft < auction.antiSnipeMinutes) {
      newEndTime = new Date(endTime.getTime() + auction.antiSnipeExtension * 60000);
      antiSnipeTriggered = true;
    }

    // Update auction
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        currentBid: amount,
        totalBids: { increment: 1 },
        endTime: newEndTime,
        status: timeLeft < 5 ? 'ENDING_SOON' : auction.status,
      }
    });

    // Notify outbid users
    const previousBids = await prisma.bid.findMany({
      where: {
        auctionId: auction.id,
        userId: { not: user.id }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    if (previousBids.length > 0) {
      await prisma.notification.createMany({
        data: previousBids.map(b => ({
          userId: b.userId,
          type: 'OUTBID',
          title: 'Surenchere !',
          message: `Quelqu'un a surencheri a ${amount} EUR. Replique vite !`,
          link: `/auction/${auction.id}`
        }))
      });
    }

    return NextResponse.json({
      success: true,
      bid: {
        id: bid.id,
        amount: bid.amount,
        finalAmount: bid.finalAmount,
        licenseType: bid.licenseType,
        user: bid.user,
        createdAt: bid.createdAt,
      },
      auction: {
        currentBid: amount,
        totalBids: auction.totalBids + 1,
        endTime: newEndTime,
        antiSnipeTriggered,
      }
    });

  } catch (error) {
    console.error('Bid error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
