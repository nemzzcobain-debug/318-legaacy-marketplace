export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const results: Record<string, unknown> = {}

        try {
              // Test 1: Simple query
      const start = Date.now()
              const userCount = await prisma.user.count()
              results.userCount = userCount
              results.queryTimeMs = Date.now() - start
              results.dbConnected = true
        } catch (error) {
              results.dbConnected = false
              results.dbError = String(error)
              results.dbErrorMessage = error instanceof Error ? error.message : 'Unknown'
              results.dbErrorStack = error instanceof Error ? error.stack?.substring(0, 500) : undefined
        }

  try {
        // Test 2: Check if verificationToken table exists
      const tokenCount = await prisma.verificationToken.count()
        results.verificationTokenCount = tokenCount
  } catch (error) {
        results.verificationTokenError = String(error)
  }

  return NextResponse.json({
        timestamp: new Date().toISOString(),
        env: {
                hasDbUrl: !!process.env.DATABASE_URL,
                dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
                hasDirectUrl: !!process.env.DIRECT_URL,
                hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
                hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
                nextAuthUrl: process.env.NEXTAUTH_URL,
                hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
                hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
                nodeEnv: process.env.NODE_ENV,
        },
        ...results,
  })
}
