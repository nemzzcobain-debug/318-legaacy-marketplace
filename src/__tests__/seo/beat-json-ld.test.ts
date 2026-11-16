import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BeatJsonLd } from '@/components/seo/JsonLd'

const baseBeat = {
  id: 'beat-1',
  title: 'Night Show',
  genre: 'Trap',
  bpm: 140,
  key: 'F Minor',
  duration: 'PT2M34S',
  coverImage: 'https://cdn.test/c.jpg',
  previewUrl: 'https://cdn.test/p.wav',
  createdAt: '2026-08-01T10:00:00.000Z',
  tags: ['dark'],
  producer: { id: 'prod-1', name: 'BRTZL' },
  offers: [
    { type: 'BASIC', label: 'Basique', price: 29 },
    { type: 'PREMIUM', label: 'Premium', price: 59 },
  ],
  liveAuction: null,
}

function render(beat = baseBeat) {
  const html = renderToStaticMarkup(
    createElement(BeatJsonLd, { beat, description: 'desc', siteUrl: 'https://site.test' })
  )
  const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
  return { html, data: JSON.parse(json) }
}

describe('BeatJsonLd', () => {
  it('décrit le beat (MusicRecording) et ses licences (Product + AggregateOffer)', () => {
    const { data } = render()
    const recording = data['@graph'].find((n: any) => n['@type'] === 'MusicRecording')
    const product = data['@graph'].find((n: any) => n['@type'] === 'Product')
    expect(recording.url).toBe('https://site.test/beat/beat-1')
    expect(recording.byArtist.url).toBe('https://site.test/producer/prod-1')
    expect(product.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '29.00',
      highPrice: '59.00',
      priceCurrency: 'EUR',
      offerCount: 2,
    })
  })

  it("empêche l'injection de code via un titre de beat malveillant", () => {
    const { html, data } = render({ ...baseBeat, title: '</script><script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert')
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(data['@graph'][0].name).toBe('</script><script>alert(1)</script>')
  })

  it("n'annonce aucune offre quand le beat n'est pas achetable", () => {
    const { data } = render({ ...baseBeat, offers: [] })
    expect(data['@graph'].some((n: any) => n['@type'] === 'Product')).toBe(false)
  })
})
