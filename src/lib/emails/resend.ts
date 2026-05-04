// @ts-expect-error - resend is optional
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

// Initialize Resend client (conditionnel — ne crashe pas si la clé est absente)
// Set RESEND_API_KEY in your .env
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// F19 FIX: Supprimer les fallbacks hardcodés — les variables d'env DOIVENT être définies
const FROM_EMAIL = process.env.EMAIL_FROM
const PLATFORM_NAME = '318 LEGAACY Marketplace'
const PLATFORM_URL = process.env.NEXTAUTH_URL

/**
 * Génère l'URL de désabonnement pour un utilisateur
 */
export function getUnsubscribeUrl(unsubscribeToken: string | null | undefined): string | undefined {
  if (!unsubscribeToken || !PLATFORM_URL) return undefined
  return `${PLATFORM_URL}/api/unsubscribe?token=${unsubscribeToken}`
}

/**
 * Génère un token d'unsubscribe unique
 */
export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString('hex')
}

if (!FROM_EMAIL && process.env.NODE_ENV === 'production') {
  console.error('[Email] CRITICAL: EMAIL_FROM non défini en production')
}
if (!PLATFORM_URL && process.env.NODE_ENV === 'production') {
  console.error('[Email] CRITICAL: NEXTAUTH_URL non défini en production')
}

// ─── Email Wrapper ───
function emailLayout(content: string, unsubscribeUrl?: string): string {
  const unsubscribeLink = unsubscribeUrl
    ? `<p style="color:#444;font-size:10px;margin:8px 0 0;">
        <a href="${unsubscribeUrl}" style="color:#666;text-decoration:underline;">Se désabonner des emails</a>
      </p>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #1e1e2e;">
      <div style="display:inline-block;background:linear-gradient(135deg,#e11d48,#ff0033);color:#000;font-weight:900;font-size:20px;width:40px;height:40px;line-height:40px;border-radius:10px;text-align:center;">3</div>
      <div style="margin-top:8px;">
        <span style="font-weight:800;font-size:16px;color:#fff;letter-spacing:0.5px;">318 LEGAACY</span>
        <br>
        <span style="font-size:9px;color:#e11d48;letter-spacing:3px;font-weight:600;">MARKETPLACE</span>
      </div>
    </div>
    <!-- Content -->
    <div style="padding:32px 0;">
      ${content}
    </div>
    <!-- Footer -->
    <div style="border-top:1px solid #1e1e2e;padding:24px 0;text-align:center;">
      <p style="color:#555;font-size:11px;margin:0;">
        ${PLATFORM_NAME} — Première plateforme d'enchères de beats en France
      </p>
      <p style="color:#444;font-size:10px;margin:8px 0 0;">
        <a href="${PLATFORM_URL}" style="color:#e11d48;text-decoration:none;">318marketplace.com</a>
      </p>
      ${unsubscribeLink}
    </div>
  </div>
</body>
</html>`
}

function button(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#e11d48,#ff0033);color:#000;font-weight:700;font-size:14px;padding:12px 32px;border-radius:12px;text-decoration:none;">${text}</a>
  </div>`
}

// ─── Email Types ───

export async function sendAuctionWonEmail(params: {
  to: string
  winnerName: string
  beatTitle: string
  producerName: string
  finalPrice: number
  license: string
  auctionId: string
}) {
  const { to, winnerName, beatTitle, producerName, finalPrice, license, auctionId } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Félicitations ${winnerName} ! 🏆</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">Tu as remporté l'enchère sur <strong style="color:#fff;">${beatTitle}</strong></p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Beat</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${beatTitle}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Producteur</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;">${producerName}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Licence</td>
          <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${license}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;border-top:1px solid #1e1e2e;">Prix final</td>
          <td style="color:#2ed573;font-size:18px;padding:6px 0;text-align:right;font-weight:800;border-top:1px solid #1e1e2e;">${finalPrice} EUR</td>
        </tr>
      </table>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;">Finalise ton achat pour télécharger les fichiers :</p>
    ${button('Payer maintenant', `${PLATFORM_URL}/auction/${auctionId}`)}
    <p style="color:#555;font-size:11px;text-align:center;margin:0;">Le paiement est sécurisé via Stripe</p>
  `)

  return sendEmail(to, `🏆 Tu as gagné l'enchère sur "${beatTitle}" !`, html)
}

export async function sendPaymentReceivedEmail(params: {
  to: string
  producerName: string
  beatTitle: string
  buyerName: string
  finalPrice: number
  commission: number
  payout: number
  license: string
}) {
  const {
    to,
    producerName: _producerName,
    beatTitle,
    buyerName,
    finalPrice,
    commission,
    payout,
    license,
  } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Vente réalisée ! 💰</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">Ton beat <strong style="color:#fff;">${beatTitle}</strong> a été vendu</p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Beat</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${beatTitle}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Acheteur</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;">${buyerName}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Licence</td>
          <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${license}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Prix de vente</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;">${finalPrice} EUR</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Commission (15%)</td>
          <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;">-${commission} EUR</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;border-top:1px solid #1e1e2e;">Ton payout</td>
          <td style="color:#2ed573;font-size:18px;padding:6px 0;text-align:right;font-weight:800;border-top:1px solid #1e1e2e;">${payout} EUR</td>
        </tr>
      </table>
    </div>

    ${button('Voir mon dashboard', `${PLATFORM_URL}/dashboard`)}
    <p style="color:#555;font-size:11px;text-align:center;margin:0;">Le virement sera effectué sur ton compte Stripe sous 7 jours</p>
  `)

  return sendEmail(to, `💰 Vente de "${beatTitle}" — ${payout} EUR`, html)
}

export async function sendNewFollowerEmail(params: {
  to: string
  producerName: string
  followerName: string
  followerAvatar?: string
  totalFollowers: number
}) {
  const { to, producerName: _producerName, followerName, totalFollowers } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Nouveau follower ! 👥</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      <strong style="color:#fff;">${followerName}</strong> te suit désormais sur 318 LEGAACY
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;font-weight:900;color:#fff;">${totalFollowers}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">followers au total</div>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;text-align:center;">Continue a publier des beats pour développer ta communauté</p>
    ${button('Voir mon profil', `${PLATFORM_URL}/dashboard`)}
  `)

  return sendEmail(to, `👥 ${followerName} te suit sur 318 LEGAACY`, html)
}

export async function sendOutbidEmail(params: {
  to: string
  userName: string
  beatTitle: string
  yourBid: number
  newBid: number
  auctionId: string
}) {
  const { to, userName: _userName, beatTitle, yourBid, newBid, auctionId } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Tu as été surenchéri ! ⚡</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Quelqu'un a placé une enchère plus élevée sur <strong style="color:#fff;">${beatTitle}</strong>
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Ton enchère</td>
          <td style="color:#e11d48;font-size:14px;padding:6px 0;text-align:right;text-decoration:line-through;">${yourBid} EUR</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Enchère actuelle</td>
          <td style="color:#2ed573;font-size:18px;padding:6px 0;text-align:right;font-weight:800;">${newBid} EUR</td>
        </tr>
      </table>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;text-align:center;">Ne laisse pas passer ce beat !</p>
    ${button('Surenchérir maintenant', `${PLATFORM_URL}/auction/${auctionId}`)}
  `)

  return sendEmail(to, `⚡ Surenchère sur "${beatTitle}" — Ton offre a été dépassée`, html)
}

export async function sendAuctionEndingSoonEmail(params: {
  to: string
  userName: string
  beatTitle: string
  currentBid: number
  auctionId: string
  minutesLeft: number
}) {
  const { to, userName: _userName, beatTitle, currentBid, auctionId, minutesLeft } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Enchère bientôt terminée ! ⏰</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      L'enchère sur <strong style="color:#fff;">${beatTitle}</strong> se termine dans <strong style="color:#e11d48;">${minutesLeft} minutes</strong>
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:12px;color:#666;margin-bottom:4px;">Enchère actuelle</div>
      <div style="font-size:28px;font-weight:900;color:#e11d48;">${currentBid} EUR</div>
    </div>

    ${button("Voir l'enchère", `${PLATFORM_URL}/auction/${auctionId}`)}
  `)

  return sendEmail(to, `⏰ "${beatTitle}" — Plus que ${minutesLeft} min !`, html)
}

export async function sendWelcomeEmail(params: { to: string; name: string }) {
  const { to, name } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Bienvenue ${name} ! 🎵</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Ton compte sur 318 LEGAACY Marketplace est créé. Tu es prêt a découvrir les meilleurs beats aux enchères.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h3 style="color:#fff;font-size:14px;margin:0 0 12px;">Par ou commencer ?</h3>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">🎧 <strong style="color:#fff;">Explore</strong> — Découvre des beats par genre, BPM et mood</p>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">🔨 <strong style="color:#fff;">Enchéris</strong> — Place tes enchères sur tes beats preferes</p>
      <p style="color:#999;font-size:12px;margin:0;">🎤 <strong style="color:#fff;">Produis</strong> — Deviens producteur et vends tes beats</p>
    </div>

    ${button('Explorer le marketplace', `${PLATFORM_URL}/marketplace`)}
  `)

  return sendEmail(to, `🎵 Bienvenue sur 318 LEGAACY Marketplace !`, html)
}

export async function sendVerificationEmail(params: { to: string; name: string; token: string }) {
  const { to, name: _name, token } = params

  const verificationUrl = `${PLATFORM_URL}/verify-email?token=${token}`

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Bienvenue sur 318 LEGAACY ! 🎵</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Clique sur le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#999;font-size:13px;margin:0;">
        Si tu n'as pas créé ce compte, ignores cet email.
      </p>
    </div>

    ${button('Confirmer mon email', verificationUrl)}
    <p style="color:#555;font-size:11px;text-align:center;margin:0;">Ce lien expire dans 24 heures</p>
  `)

  return sendEmail(to, `Confirme ton email — 318 LEGAACY Marketplace`, html)
}

export async function sendPasswordResetEmail(params: { to: string; name: string; token: string }) {
  const { to, name: _name, token } = params

  const resetUrl = `${PLATFORM_URL}/reset-password?token=${token}`

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Réinitialise ton mot de passe 🔐</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Tu as demandé a réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour continuer.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#999;font-size:12px;margin:0 0 12px;">Ce lien expire dans <strong style="color:#e11d48;">1 heure</strong>.</p>
      <p style="color:#666;font-size:11px;margin:0;">Si tu n'as pas demandé une réinitialisation, ignore ce message.</p>
    </div>

    ${button('Réinitialiser mon mot de passe', resetUrl)}
  `)

  return sendEmail(to, `🔐 Réinitialise ton mot de passe — 318 LEGAACY`, html)
}

// ─── Producer Application Emails ───

export async function sendProducerApplicationEmail(params: { to: string; name: string }) {
  const { to, name } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Candidature reçue ! 📩</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Merci <strong style="color:#fff;">${name}</strong>, ta candidature pour devenir producteur sur 318 LEGAACY a bien été enregistrée.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h3 style="color:#fff;font-size:14px;margin:0 0 12px;">Et maintenant ?</h3>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">1️⃣ Notre équipe examine ta candidature (sous 48h)</p>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">2️⃣ Tu recevras un email de confirmation ou de refus</p>
      <p style="color:#999;font-size:12px;margin:0;">3️⃣ Si approuvé, tu pourras immédiatement mettre tes beats aux enchères</p>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;text-align:center;">Tu peux suivre l'état de ta demande ici :</p>
    ${button('Voir ma candidature', `${PLATFORM_URL}/producers`)}
  `)

  return sendEmail(to, `📩 Candidature producteur reçue — 318 LEGAACY`, html)
}

export async function sendProducerApprovedEmail(params: { to: string; name: string }) {
  const { to, name } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Bienvenue dans l'équipe ! 🎉</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      <strong style="color:#fff;">${name}</strong>, ta candidature producteur a été <strong style="color:#2ed573;">approuvée</strong> !
    </p>

    <div style="background:#13131a;border:1px solid #2ed57330;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:16px;">
        <span style="display:inline-block;background:#2ed57320;color:#2ed573;font-weight:700;font-size:14px;padding:8px 24px;border-radius:8px;">✅ APPROUVÉ</span>
      </div>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">🎵 <strong style="color:#fff;">Upload</strong> tes beats depuis ton dashboard</p>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">🔨 <strong style="color:#fff;">Crée des enchères</strong> pour vendre tes productions</p>
      <p style="color:#999;font-size:12px;margin:0;">💰 <strong style="color:#fff;">Encaisse</strong> tes ventes directement via Stripe</p>
    </div>

    ${button('Commencer à vendre', `${PLATFORM_URL}/producers/upload`)}
  `)

  return sendEmail(to, `🎉 Candidature approuvée — Bienvenue producteur 318 LEGAACY !`, html)
}

export async function sendProducerRejectedEmail(params: {
  to: string
  name: string
  reason?: string
}) {
  const { to, name, reason } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Résultat de ta candidature</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      <strong style="color:#fff;">${name}</strong>, après examen, ta candidature producteur n'a pas été retenue pour le moment.
    </p>

    <div style="background:#13131a;border:1px solid #e11d4830;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:16px;">
        <span style="display:inline-block;background:#e11d4820;color:#e11d48;font-weight:700;font-size:14px;padding:8px 24px;border-radius:8px;">❌ NON RETENUE</span>
      </div>
      ${reason ? `<p style="color:#999;font-size:12px;margin:0 0 12px;"><strong style="color:#fff;">Motif :</strong> ${reason}</p>` : ''}
      <p style="color:#999;font-size:12px;margin:0;">Tu peux améliorer ton profil et resoumettre une candidature ultérieurement.</p>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;text-align:center;">Des questions ? Contacte-nous directement.</p>
    ${button('Retour au marketplace', `${PLATFORM_URL}/marketplace`)}
  `)

  return sendEmail(to, `Résultat de ta candidature producteur — 318 LEGAACY`, html)
}

export async function sendAdminNewApplicationEmail(params: {
  adminEmail: string
  applicantName: string
  applicantEmail: string
  applicantId: string
  bio: string
  portfolio?: string
}) {
  const { adminEmail, applicantName, applicantEmail, applicantId, bio, portfolio } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Nouvelle candidature producteur 🔔</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      <strong style="color:#fff;">${applicantName}</strong> souhaite devenir producteur sur 318 LEGAACY.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Nom</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${applicantName}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Email</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;">${applicantEmail}</td>
        </tr>
        ${
          portfolio
            ? `<tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Portfolio</td>
          <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;"><a href="${portfolio}" style="color:#e11d48;">${portfolio}</a></td>
        </tr>`
            : ''
        }
      </table>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #1e1e2e;">
        <p style="color:#666;font-size:11px;margin:0 0 4px;">BIO</p>
        <p style="color:#ccc;font-size:12px;margin:0;line-height:1.5;">${bio}</p>
      </div>
    </div>

    ${button('Examiner la candidature', `${PLATFORM_URL}/producer/${applicantId}`)}
  `)

  return sendEmail(adminEmail, `🔔 Nouvelle candidature producteur — ${applicantName}`, html)
}

// ─── Beat Upload Confirmation Email ───

export async function sendBeatUploadConfirmationEmail(params: {
  to: string
  producerName: string
  beatTitle: string
  genre: string
  bpm: number
  hasAuction: boolean
  auctionStartPrice?: number
  auctionDuration?: number
}) {
  const { to, producerName, beatTitle, genre, bpm, hasAuction, auctionStartPrice, auctionDuration } = params

  const auctionSection = hasAuction
    ? `<tr>
        <td style="color:#666;font-size:12px;padding:6px 0;border-top:1px solid #1e1e2e;">Enchère</td>
        <td style="color:#2ed573;font-size:12px;padding:6px 0;text-align:right;font-weight:600;border-top:1px solid #1e1e2e;">Active — ${auctionStartPrice} EUR (${auctionDuration || 24}h)</td>
      </tr>`
    : `<tr>
        <td style="color:#666;font-size:12px;padding:6px 0;border-top:1px solid #1e1e2e;">Mode</td>
        <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;font-weight:600;border-top:1px solid #1e1e2e;">Achat direct</td>
      </tr>`

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Beat en ligne ! 🎶</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Bien joué <strong style="color:#fff;">${producerName}</strong>, ton beat a été publié avec succès sur 318 LEGAACY !
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Titre</td>
          <td style="color:#fff;font-size:14px;padding:6px 0;text-align:right;font-weight:700;">${beatTitle}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Genre</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;">${genre}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">BPM</td>
          <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${bpm}</td>
        </tr>
        ${auctionSection}
      </table>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 4px;text-align:center;">Ton beat est maintenant visible par toute la communauté.</p>
    <p style="color:#666;font-size:12px;margin:0 0 16px;text-align:center;">Partage-le pour maximiser ta visibilité !</p>
    ${button('Voir mon dashboard', `${PLATFORM_URL}/dashboard`)}
  `)

  return sendEmail(to, `🎶 "${beatTitle}" est en ligne sur 318 LEGAACY !`, html)
}

// ─── Guest Purchase Email ───

export async function sendGuestPurchaseEmail(params: {
  to: string
  beatTitle: string
  producerName: string
  licenseType: string
  finalPrice: number
  downloadUrl: string
  magicLoginUrl: string
}) {
  const { to, beatTitle, producerName, licenseType, finalPrice, downloadUrl, magicLoginUrl } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Ton beat est prêt ! 🎵</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Ton achat de <strong style="color:#fff;">${beatTitle}</strong> a été confirmé. Tu peux le télécharger dès maintenant.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Beat</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${beatTitle}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Producteur</td>
          <td style="color:#fff;font-size:12px;padding:6px 0;text-align:right;">${producerName}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Licence</td>
          <td style="color:#e11d48;font-size:12px;padding:6px 0;text-align:right;font-weight:600;">${licenseType}</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;border-top:1px solid #1e1e2e;">Prix</td>
          <td style="color:#2ed573;font-size:18px;padding:6px 0;text-align:right;font-weight:800;border-top:1px solid #1e1e2e;">${finalPrice} EUR</td>
        </tr>
      </table>
    </div>

    ${button('Télécharger mon beat', downloadUrl)}

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:16px;margin:24px 0;">
      <p style="color:#fff;font-size:13px;font-weight:600;margin:0 0 8px;">🔑 Ton compte a été créé automatiquement</p>
      <p style="color:#999;font-size:12px;margin:0 0 12px;">
        Un compte 318 LEGAACY a été créé avec ton email. Tu peux y accéder à tout moment pour retrouver tes achats et téléchargements.
      </p>
      ${button('Accéder à mon compte', magicLoginUrl)}
    </div>

    <p style="color:#555;font-size:11px;text-align:center;margin:0;">Ce lien de connexion expire dans 24 heures. Tu pourras toujours te connecter avec ton email.</p>
  `)

  return sendEmail(to, `Ton beat est prêt ! 🎵 — "${beatTitle}"`, html)
}

// ─── Core Send Function ───
// Auto-fetches unsubscribe token from DB based on recipient email
async function sendEmail(to: string, subject: string, html: string) {
  // F19 FIX: Vérifier que toutes les config sont présentes
  if (!FROM_EMAIL || !PLATFORM_URL) {
    console.error('[Email] Missing EMAIL_FROM or NEXTAUTH_URL env var')
    return { success: false, reason: 'missing_config' }
  }

  // Skip if no API key configured or Resend not initialized
  if (!resend || !process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Email] Skipped (no API key): "${subject}"`)
    }
    return { success: false, reason: 'no_api_key' }
  }

  // Auto-fetch unsubscribe token for the recipient
  let unsubscribeToken: string | null = null
  try {
    const { prisma: db } = await import('@/lib/prisma')
    const user = await db.user.findUnique({
      where: { email: to },
      select: { id: true, unsubscribeToken: true },
    })
    if (user) {
      if (!user.unsubscribeToken) {
        // Generate token on first email send
        const token = randomBytes(32).toString('hex')
        await db.user.update({
          where: { id: user.id },
          data: { unsubscribeToken: token },
        })
        unsubscribeToken = token
      } else {
        unsubscribeToken = user.unsubscribeToken
      }
    }
  } catch (err) {
    // Non-blocking: continue without unsubscribe link
    console.warn('[Email] Could not fetch unsubscribe token:', String(err))
  }

  // Injecter le lien de désabonnement dans le footer si token present
  let finalHtml = html
  if (unsubscribeToken) {
    const unsubUrl = `${PLATFORM_URL}/api/unsubscribe?token=${unsubscribeToken}`
    const unsubLink = `<p style="color:#444;font-size:10px;margin:8px 0 0;text-align:center;"><a href="${unsubUrl}" style="color:#666;text-decoration:underline;">Se désabonner des emails</a></p>`
    // Insert before closing </body> tag
    finalHtml = html.replace('</body>', `${unsubLink}</body>`)
  }

  try {
    const headers: Record<string, string> = {}
    if (unsubscribeToken) {
      headers['List-Unsubscribe'] = `<${PLATFORM_URL}/api/unsubscribe?token=${unsubscribeToken}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }

    const { data, error } = await resend.emails.send({
      from: `318 LEGAACY <${FROM_EMAIL}>`,
      to,
      subject,
      html: finalHtml,
      headers: unsubscribeToken ? headers : undefined,
    })

    if (error) {
      console.error(`[Email] Error sending "${subject}":`, error)
      return { success: false, error }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Email] Sent "${subject}" (id: ${data?.id})`)
    }
    return { success: true, id: data?.id }
  } catch (error) {
    console.error(`[Email] Exception sending "${subject}":`, error)
    return { success: false, error }
  }
}
