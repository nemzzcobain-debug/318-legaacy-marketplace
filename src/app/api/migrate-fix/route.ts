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

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT`)
    const result = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'image'`)
    return NextResponse.json({ success: true, message: 'image column added', result })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
