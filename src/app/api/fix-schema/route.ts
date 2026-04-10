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
          // Fix passwordHash - must be nullable for OAuth users
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL`)
          // Fix name - must be nullable for OAuth users who might not have a name
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL`)
          // Verify columns
          const result = await prisma.$queryRawUnsafe(`
                                                            SELECT column_name, is_nullable 
                                                            FROM information_schema.columns 
                                                            WHERE table_name = 'User' 
                                                            AND column_name IN ('passwordHash', 'name', 'image')
                                                          `)
          return NextResponse.json({ success: true, message: 'Schema fixed', columns: result })
        } catch (error) {
          return NextResponse.json({ error: String(error) }, { status: 500 })
        } finally {
          await prisma.$disconnect()
        }
  }
