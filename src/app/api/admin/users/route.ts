export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
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
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
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

    // Mask email addresses for security
    const maskedUsers = users.map(user => ({
      ...user,
      email: maskEmail(user.email),
    }));

    return NextResponse.json(maskedUsers);
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
