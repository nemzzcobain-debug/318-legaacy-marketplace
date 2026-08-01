import { describe, expect, it } from 'vitest'
import {
  ADMIN_PRODUCER_APPLICATIONS_URL,
  resolveNotificationLink,
} from '@/lib/notification-links'

describe('liens des notifications', () => {
  it('envoie une nouvelle candidature vers la liste à approuver', () => {
    expect(
      resolveNotificationLink({
        type: 'SYSTEM',
        title: 'Nouvelle candidature producteur',
        link: '/producer/ancien-id',
      })
    ).toBe(ADMIN_PRODUCER_APPLICATIONS_URL)
  })

  it('conserve le lien normal des autres notifications', () => {
    expect(
      resolveNotificationLink({
        type: 'OUTBID',
        title: 'Tu as été surenchéri',
        link: '/auction/auction-id',
      })
    ).toBe('/auction/auction-id')
  })
})
