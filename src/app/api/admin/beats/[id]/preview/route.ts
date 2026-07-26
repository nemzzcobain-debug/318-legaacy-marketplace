export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, parseSupabaseUrl } from '@/lib/supabase'

/**
 * Flux audio de prévisualisation réservé à l'administrateur.
 *
 * Le navigateur charge une URL du même domaine. Le serveur récupère ensuite
 * temporairement le fichier Supabase, y compris lorsqu'il se trouve dans un
 * bucket privé, sans exposer de clé ni rendre l'original public.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const beat = await prisma.beat.findUnique({
      where: { id },
      select: {
        audioUrl: true,
        audioOriginal: true,
      },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    // Utiliser en priorité l'aperçu de 60 secondes. L'original privé sert
    // seulement de secours pour les anciens beats qui n'ont pas d'aperçu.
    const sourceUrl = beat.audioUrl || beat.audioOriginal
    if (!sourceUrl) {
      return NextResponse.json({ error: 'Aucun fichier audio disponible' }, { status: 404 })
    }

    const parsed = parseSupabaseUrl(sourceUrl)
    const upstreamUrl = parsed
      ? await getSignedUrl(parsed.bucket, parsed.path, 5 * 60)
      : sourceUrl

    if (!upstreamUrl) {
      return NextResponse.json({ error: "Impossible d'accéder au fichier audio" }, { status: 502 })
    }

    const range = request.headers.get('range')
    const upstream = await fetch(upstreamUrl, {
      headers: range ? { Range: range } : undefined,
      cache: 'no-store',
    })

    if (!upstream.ok && upstream.status !== 206) {
      console.error('Erreur flux aperçu admin:', upstream.status, await upstream.text())
      return NextResponse.json({ error: 'Fichier audio indisponible' }, { status: 502 })
    }

    const headers = new Headers()
    headers.set('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
    headers.set('Cache-Control', 'private, no-store, max-age=0')
    headers.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')

    for (const header of ['content-length', 'content-range']) {
      const value = upstream.headers.get(header)
      if (value) headers.set(header, value)
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch (error) {
    console.error('Admin beat preview error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
