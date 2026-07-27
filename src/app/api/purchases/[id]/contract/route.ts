export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import {
  generateLicenseContractPdf,
  getContractFileName,
  type LicenseContractData,
} from '@/lib/license-contract'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      buyer: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
        },
      },
      beat: {
        select: {
          id: true,
          title: true,
          genre: true,
          bpm: true,
          key: true,
          producer: {
            select: {
              id: true,
              name: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!purchase || purchase.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Achat confirmé introuvable' }, { status: 404 })
  }

  const isBuyer = purchase.buyerId === session.user.id
  const isProducer = purchase.beat.producer.id === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isBuyer && !isProducer && !isAdmin) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const contractData: LicenseContractData = {
    purchaseId: purchase.id,
    purchaseType: purchase.type,
    transactionId: purchase.stripePaymentId,
    purchasedAt: purchase.createdAt,
    amount: purchase.amount,
    licenseType: purchase.licenseType,
    buyer: {
      name: purchase.buyer.displayName || purchase.buyer.name,
      email: purchase.buyer.email,
    },
    producer: {
      name: purchase.beat.producer.displayName || purchase.beat.producer.name,
      email: purchase.beat.producer.email,
    },
    beat: {
      id: purchase.beat.id,
      title: purchase.beat.title,
      genre: purchase.beat.genre,
      bpm: purchase.beat.bpm,
      key: purchase.beat.key,
    },
  }
  const pdf = generateLicenseContractPdf(contractData)
  const fileName = getContractFileName(contractData)

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
