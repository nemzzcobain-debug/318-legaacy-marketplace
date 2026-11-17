import { describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    auction: { findMany: vi.fn().mockResolvedValue([]) },
    beat: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 'beat-1', updatedAt: new Date('2026-08-02T10:00:00Z') }]),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    playlist: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import sitemap from '@/app/sitemap'
import { PUBLIC_BEAT_WHERE } from '@/lib/public-catalog'

describe('sitemap', () => {
  it('référence la page publique de chaque beat visible', async () => {
    const entries = await sitemap()
    expect(entries.some((e) => e.url.endsWith('/beat/beat-1'))).toBe(true)
    expect(prismaMock.beat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: PUBLIC_BEAT_WHERE })
    )
  })
})
