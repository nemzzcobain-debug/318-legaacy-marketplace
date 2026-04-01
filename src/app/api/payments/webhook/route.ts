export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * DEPRECATED - Webhooks Stripe consolidé
 *
 * Ce fichier est maintenant DÉPRÉCIÉ.
 * Tous les événements Stripe (checkout.session.completed, payment_intent.succeeded, etc.)
 * sont traités par le webhook consolidé à:
 *   POST /api/stripe/webhook
 *
 * Configurez votre endpoint Stripe pour:
 *   https://yourapp.com/api/stripe/webhook
 *
 * Les événements envoyés à ce point de terminaison retourneront un message de dépréciation.
 */

export async function POST() {
  console.warn(
    '[WEBHOOK] Accès à /api/payments/webhook - CE POINT DE TERMINAISON EST DÉPRÉCIÉ'
  )
  console.warn(
    '[WEBHOOK] Utilisez /api/stripe/webhook à la place pour tous les événements Stripe'
  )

  return NextResponse.json(
    {
      error: 'Ce point de terminaison est déprécié',
      message: 'Veuillez configurer votre webhook Stripe sur POST /api/stripe/webhook',
      deprecated: true,
    },
    { status: 410 }
  )
}
