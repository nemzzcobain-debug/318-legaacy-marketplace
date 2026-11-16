import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, constructEventMock, completeAuctionSaleMock, reportMock } = vi.hoisted(() => ({
  prismaMock: {
    stripeEvent: { create: vi.fn(), deleteMany: vi.fn() },
  },
  constructEventMock: vi.fn(),
  completeAuctionSaleMock: vi.fn(),
  reportMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/stripe', () => ({ stripe: { webhooks: { constructEvent: constructEventMock } } }))
vi.mock('@/lib/monitoring', () => ({ reportOperationalIssue: reportMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/lib/auction-sale', () => ({
  completeAuctionSale: completeAuctionSaleMock,
  sendAuctionSaleMessages: vi.fn(),
}))
vi.mock('@/lib/emails/resend', () => ({
  sendPaymentReceivedEmail: vi.fn(),
  sendGuestPurchaseEmail: vi.fn(),
  sendPurchaseConfirmedEmail: vi.fn(),
  sendNtfy: vi.fn(),
}))
vi.mock('@/lib/license-contract', () => ({
  generateLicenseContractPdf: vi.fn(),
  getContractFileName: vi.fn(),
}))

import { POST } from '@/app/api/stripe/webhook/route'

function webhookRequest() {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: '{}',
    headers: { 'stripe-signature': 'sig' },
  })
}

const succeededEvent = {
  id: 'evt_1',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_1',
      metadata: { auctionId: 'auction-1', buyerId: 'buyer-1', buyNow: 'true' },
    },
  },
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    constructEventMock.mockReturnValue(succeededEvent)
    prismaMock.stripeEvent.create.mockResolvedValue({})
    prismaMock.stripeEvent.deleteMany.mockResolvedValue({ count: 1 })
  })

  it("libère l'événement et renvoie 500 quand le traitement échoue, pour que Stripe le rejoue", async () => {
    completeAuctionSaleMock.mockRejectedValue(new Error('base indisponible'))

    const response = await POST(webhookRequest())

    expect(response.status).toBe(500)
    expect(prismaMock.stripeEvent.deleteMany).toHaveBeenCalledWith({ where: { id: 'evt_1' } })
  })

  it("garde l'événement marqué traité quand tout s'est bien passé", async () => {
    completeAuctionSaleMock.mockResolvedValue({ outcome: 'ALREADY_COMPLETED', purchase: null })

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(prismaMock.stripeEvent.deleteMany).not.toHaveBeenCalled()
    expect(completeAuctionSaleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionId: 'auction-1',
        paymentIntentId: 'pi_1',
        buyerId: 'buyer-1',
        buyNow: true,
      })
    )
  })

  it('ignore un événement déjà traité sans le rejouer', async () => {
    prismaMock.stripeEvent.create.mockRejectedValue({ code: 'P2002' })

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, duplicate: true })
    expect(completeAuctionSaleMock).not.toHaveBeenCalled()
  })

  it('alerte sans rejouer quand un second paiement arrive sur une enchère déjà vendue', async () => {
    completeAuctionSaleMock.mockResolvedValue({ outcome: 'CONFLICT', reason: 'déjà vendue' })

    const response = await POST(webhookRequest())

    expect(response.status).toBe(200)
    expect(reportMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical', area: 'webhook' })
    )
    expect(prismaMock.stripeEvent.deleteMany).not.toHaveBeenCalled()
  })
})
