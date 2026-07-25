export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const base64UrlSchema = z
  .string()
  .min(16)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/, 'Clé push invalide')

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith('https://'), 'Endpoint push non sécurisé'),
  keys: z.object({
    p256dh: base64UrlSchema,
    auth: base64UrlSchema,
  }),
})

const deleteSchema = z.object({
  endpoint: z.string().url().max(2048),
})

function noStoreJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

// GET — Indiquer au navigateur si Web Push est configuré.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return noStoreJson({ error: 'Non authentifié' }, 401)
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return noStoreJson({ error: 'Notifications push non configurées' }, 503)
  }

  return noStoreJson({ publicKey })
}

// POST — Associer l'abonnement de cet appareil au compte connecté.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return noStoreJson({ error: 'Non authentifié' }, 401)
    }

    const parsed = subscriptionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return noStoreJson({ error: parsed.error.errors[0].message }, 400)
    }

    const { endpoint, keys } = parsed.data
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.user.id,
        userAgent: request.headers.get('user-agent')?.slice(0, 500),
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.user.id,
        userAgent: request.headers.get('user-agent')?.slice(0, 500),
      },
    })

    return noStoreJson({ success: true }, 201)
  } catch (error) {
    console.error('[WEB_PUSH] Enregistrement impossible:', String(error))
    return noStoreJson({ error: 'Impossible d’activer les notifications' }, 500)
  }
}

// DELETE — Désactiver uniquement cet appareil pour le compte connecté.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return noStoreJson({ error: 'Non authentifié' }, 401)
    }

    const parsed = deleteSchema.safeParse(await request.json())
    if (!parsed.success) {
      return noStoreJson({ error: 'Abonnement push invalide' }, 400)
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: parsed.data.endpoint,
        userId: session.user.id,
      },
    })

    return noStoreJson({ success: true })
  } catch (error) {
    console.error('[WEB_PUSH] Désactivation impossible:', String(error))
    return noStoreJson({ error: 'Impossible de désactiver les notifications' }, 500)
  }
}
