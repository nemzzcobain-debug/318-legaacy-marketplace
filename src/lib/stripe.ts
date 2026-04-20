import Stripe from 'stripe'

// Initialisation lazy pour éviter le crash au build si STRIPE_SECRET_KEY est absent
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY manquant dans .env')
  }
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
    typescript: true,
  })
  return _stripe
}

// Compat : export `stripe` comme getter lazy
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop]
  },
})

// Commission de la plateforme
export const PLATFORM_COMMISSION = Number(process.env.PLATFORM_COMMISSION_PERCENT || 15) / 100

/**
 * Calcule le split entre producteur et plateforme
 */
export function calculatePaymentSplit(totalAmount: number) {
  const commissionAmount = Math.round(totalAmount * PLATFORM_COMMISSION * 100) / 100
  const producerAmount = Math.round((totalAmount - commissionAmount) * 100) / 100

  return {
    total: totalAmount,
    commission: commissionAmount,
    producerPayout: producerAmount,
    commissionPercent: PLATFORM_COMMISSION * 100,
  }
}

/**
 * Multiplicateurs de licence
 */
export const LICENSE_MULTIPLIERS = {
  BASIC: 1,
  PREMIUM: 2.5,
  EXCLUSIVE: 10,
}

/**
 * Calcule le prix final selon la licence
 */
export function calculateFinalPrice(bidAmount: number, licenseType: string): number {
  const multiplier = LICENSE_MULTIPLIERS[licenseType as keyof typeof LICENSE_MULTIPLIERS] || 1
  return Math.round(bidAmount * multiplier * 100) / 100
}

/**
 * Cree un compte Stripe Connect pour un producteur
 */
export async function createConnectAccount(email: string, name: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'FR',
    email,
    business_type: 'individual',
    individual: {
      first_name: name.split(' ')[0] || name,
      last_name: name.split(' ').slice(1).join(' ') || name,
      email,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      mcc: '5735', // Record stores
      product_description: 'Vente de beats / instrumentales via 318 LEGAACY Marketplace',
    },
    metadata: {
      platform: '318_legaacy',
    },
  })

  return account
}

/**
 * Cree un lien d'onboarding Stripe Connect
 */
export async function createOnboardingLink(accountId: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXTAUTH_URL}/producers/stripe/refresh`,
    return_url: `${process.env.NEXTAUTH_URL}/producers/stripe/complete`,
    type: 'account_onboarding',
  })

  return accountLink
}

/**
 * Verifie si un compte Connect est actif et peut recevoir des paiements
 */
export async function isConnectAccountReady(accountId: string): Promise<boolean> {
  try {
    const account = await stripe.accounts.retrieve(accountId)
    return account.charges_enabled && account.payouts_enabled
  } catch {
    return false
  }
}

/**
 * Cree un lien de dashboard Stripe Express pour le producteur
 */
export async function createDashboardLink(accountId: string) {
  const loginLink = await stripe.accounts.createLoginLink(accountId)
  return loginLink
}

/**
 * Cree un PaymentIntent pour un achat direct de beat (hors encheres)
 */
export async function createBeatPurchaseIntent({
  amount,
  producerStripeAccountId,
  beatId,
  buyerEmail,
  beatTitle,
  licenseType,
}: {
  amount: number
  producerStripeAccountId: string
  beatId: string
  buyerEmail: string
  beatTitle: string
  licenseType: string
}) {
  const { commission, producerPayout } = calculatePaymentSplit(amount)

  const amountInCents = Math.round(amount * 100)
  const commissionInCents = Math.round(commission * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'eur',
    application_fee_amount: commissionInCents,
    transfer_data: {
      destination: producerStripeAccountId,
    },
    metadata: {
      beatId,
      type: 'direct_purchase',
      platform: '318_legaacy',
      beatTitle,
      licenseType,
      commission: commission.toString(),
      producerPayout: producerPayout.toString(),
    },
    receipt_email: buyerEmail,
    description: `318 LEGAACY - ${beatTitle} (Licence ${licenseType})`,
  })

  return {
    paymentIntent,
    clientSecret: paymentIntent.client_secret,
    commission,
    producerPayout,
  }
}

/**
 * Cree un PaymentIntent avec split automatique vers le producteur
 */
export async function createAuctionPaymentIntent({
  amount,
  producerStripeAccountId,
  auctionId,
  buyerEmail,
  beatTitle,
  licenseType,
}: {
  amount: number
  producerStripeAccountId: string
  auctionId: string
  buyerEmail: string
  beatTitle: string
  licenseType: string
}) {
  const { commission, producerPayout } = calculatePaymentSplit(amount)

  // Montant en centimes pour Stripe
  const amountInCents = Math.round(amount * 100)
  const commissionInCents = Math.round(commission * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'eur',
    // Le producteur recoit le montant moins la commission
    application_fee_amount: commissionInCents,
    transfer_data: {
      destination: producerStripeAccountId,
    },
    metadata: {
      auctionId,
      platform: '318_legaacy',
      beatTitle,
      licenseType,
      commission: commission.toString(),
      producerPayout: producerPayout.toString(),
    },
    receipt_email: buyerEmail,
    description: `318 LEGAACY - ${beatTitle} (Licence ${licenseType})`,
  })

  return {
    paymentIntent,
    clientSecret: paymentIntent.client_secret,
    commission,
    producerPayout,
  }
}
