export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * DEPRECATED — Route de checkout legacy
 *
 * Cette route utilisait Stripe Checkout Sessions (redirection externe).
 * Elle a ete remplacee par POST /api/stripe/checkout qui utilise
 * PaymentIntent avec Stripe Elements inline.
 *
 * Les clients doivent migrer vers /api/stripe/checkout.
 */

export async function POST() {
  return NextResponse.json(
    {
      error: 'Route depreciee. Utilisez POST /api/stripe/checkout',
      deprecated: true,
    },
    { status: 410 }
  )
}
