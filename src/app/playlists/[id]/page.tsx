import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import PlaylistClient from './PlaylistClient'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        description: true,
        visibility: true,
        user: {
          select: {
            name: true,
            displayName: true,
          },
        },
        beats: {
          take: 1,
          select: {
            beat: {
              select: {
                coverImage: true,
              },
            },
          },
        },
        _count: {
          select: {
            beats: true,
          },
        },
      },
    })

    if (!playlist || playlist.visibility !== 'PUBLIC') {
      return {
        title: 'Playlist non trouvée | 318 LEGAACY',
        description: 'Cette playlist n\'existe pas ou n\'est pas publique.',
      }
    }

    const author = playlist.user.displayName || playlist.user.name
    const title = `${playlist.name} par ${author} | Playlist | 318 LEGAACY`
    const description = playlist.description
      ? playlist.description.substring(0, 160)
      : `Écoutez la playlist "${playlist.name}" de ${author} avec ${playlist._count.beats} beats sur 318 LEGAACY Marketplace`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/playlists/${params.id}`,
        type: 'music.playlist',
        images: playlist.beats[0]?.beat.coverImage
          ? [
              {
                url: playlist.beats[0].beat.coverImage,
                width: 400,
                height: 400,
                alt: playlist.name,
              },
            ]
          : undefined,
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: playlist.beats[0]?.beat.coverImage ? [playlist.beats[0].beat.coverImage] : undefined,
      },
    }
  } catch (error) {
    console.error('Error generating metadata for playlist:', error)
    return {
      title: 'Playlist | 318 LEGAACY',
      description: 'Découvrez les playlists de beats sur 318 LEGAACY Marketplace',
    }
  }
}

export default function PlaylistPage() {
  return <PlaylistClient />
}
