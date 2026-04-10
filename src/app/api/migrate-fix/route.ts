export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export async function GET(request: Request) {
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = new PrismaClient({
        datasources: { db: { url: process.env.DIRECT_URL } }
  })

  const results: string[] = []

      try {
            // Add twoFactorEnabled column
      await prisma.$executeRawUnsafe(`
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false
                `)
            results.push('Added twoFactorEnabled column')
      } catch (e) {
            results.push('twoFactorEnabled: ' + String(e))
      }

  try {
        // Add twoFactorSecret column
      await prisma.$executeRawUnsafe(`
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT
                `)
        results.push('Added twoFactorSecret column')
  } catch (e) {
        results.push('twoFactorSecret: ' + String(e))
  }

  await prisma.$disconnect()

  return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString()
  })
}
