import { Resend } from 'resend'

// Initialize Resend client (conditionnel — ne crashe pas si la clé est absente)
// Set RESEND_API_KEY in your .env
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@318legaacy.com'
const PLATFORM_NAME = '318 LEGAACY Marketplace'
const PLATFORM_URL = process.env.NEXTAUTH_URL || 'https://www.318marketplace.com'

// ─── Email Wrapper ───
function emailLayout(content: string): string {
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
        ${PLATFORM_NAME} — Premiere plateforme d'encheres de beats en France
      </p>
      <p style="color:#444;font-size:10px;margin:8px 0 0;">
        <a href="${PLATFORM_URL}" style="color:#e11d48;text-decoration:none;">318marketplace.com</a>
      </p>
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
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Felicitations ${winnerName} ! 🏆</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">Tu as remporte l'enchere sur <strong style="color:#fff;">${beatTitle}</strong></p>

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

    <p style="color:#999;font-size:13px;margin:0 0 8px;">Finalise ton achat pour telecharger les fichiers :</p>
    ${button('Payer maintenant', `${PLATFORM_URL}/auction/${auctionId}`)}
    <p style="color:#555;font-size:11px;text-align:center;margin:0;">Le paiement est securise via Stripe</p>
  `)

  return sendEmail(to, `🏆 Tu as gagne l'enchere sur "${beatTitle}" !`, html)
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
  const { to, producerName, beatTitle, buyerName, finalPrice, commission, payout, license } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Vente realisee ! 💰</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">Ton beat <strong style="color:#fff;">${beatTitle}</strong> a ete vendu</p>

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
    <p style="color:#555;font-size:11px;text-align:center;margin:0;">Le virement sera effectue sur ton compte Stripe sous 7 jours</p>
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
  const { to, producerName, followerName, totalFollowers } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Nouveau follower ! 👥</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      <strong style="color:#fff;">${followerName}</strong> te suit desormais sur 318 LEGAACY
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;font-weight:900;color:#fff;">${totalFollowers}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">followers au total</div>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;text-align:center;">Continue a publier des beats pour developper ta communaute</p>
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
  const { to, userName, beatTitle, yourBid, newBid, auctionId } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Tu as ete surencherit ! ⚡</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Quelqu'un a place une enchere plus elevee sur <strong style="color:#fff;">${beatTitle}</strong>
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Ton enchere</td>
          <td style="color:#e11d48;font-size:14px;padding:6px 0;text-align:right;text-decoration:line-through;">${yourBid} EUR</td>
        </tr>
        <tr>
          <td style="color:#666;font-size:12px;padding:6px 0;">Enchere actuelle</td>
          <td style="color:#2ed573;font-size:18px;padding:6px 0;text-align:right;font-weight:800;">${newBid} EUR</td>
        </tr>
      </table>
    </div>

    <p style="color:#999;font-size:13px;margin:0 0 8px;text-align:center;">Ne laisse pas passer ce beat !</p>
    ${button('Surencherir maintenant', `${PLATFORM_URL}/auction/${auctionId}`)}
  `)

  return sendEmail(to, `⚡ Surenchere sur "${beatTitle}" — Ton offre a ete depassee`, html)
}

export async function sendAuctionEndingSoonEmail(params: {
  to: string
  userName: string
  beatTitle: string
  currentBid: number
  auctionId: string
  minutesLeft: number
}) {
  const { to, userName, beatTitle, currentBid, auctionId, minutesLeft } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Enchere bientot terminee ! ⏰</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      L'enchere sur <strong style="color:#fff;">${beatTitle}</strong> se termine dans <strong style="color:#e11d48;">${minutesLeft} minutes</strong>
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:12px;color:#666;margin-bottom:4px;">Enchere actuelle</div>
      <div style="font-size:28px;font-weight:900;color:#e11d48;">${currentBid} EUR</div>
    </div>

    ${button('Voir l\'enchere', `${PLATFORM_URL}/auction/${auctionId}`)}
  `)

  return sendEmail(to, `⏰ "${beatTitle}" — Plus que ${minutesLeft} min !`, html)
}

export async function sendWelcomeEmail(params: {
  to: string
  name: string
}) {
  const { to, name } = params

  const html = emailLayout(`
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 8px;">Bienvenue ${name} ! 🎵</h1>
    <p style="color:#999;font-size:14px;margin:0 0 24px;">
      Ton compte sur 318 LEGAACY Marketplace est cree. Tu es pret a decouvrir les meilleurs beats aux encheres.
    </p>

    <div style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h3 style="color:#fff;font-size:14px;margin:0 0 12px;">Par ou commencer ?</h3>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">🎧 <strong style="color:#fff;">Explore</strong> — Decouvre des beats par genre, BPM et mood</p>
      <p style="color:#999;font-size:12px;margin:0 0 8px;">🔨 <strong style="color:#fff;">Encheris</strong> — Place tes encheres sur tes beats preferes</p>
      <p style="color:#999;font-size:12px;margin:0;">🎤 <strong style="color:#fff;">Produis</strong> — Deviens producteur et vends tes beats</p>
    </div>

    ${button('Explorer le marketplace', `${PLATFORM_URL}/marketplace`)}
  `)

  return sendEmail(to, `🎵 Bienvenue sur 318 LEGAACY Marketplace !`, html)
}

// ─── Core Send Function ───
async function sendEmail(to: string, subject: string, html: string) {
  // Skip if no API key configured or Resend not initialized
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log(`[Email] Skipped (no API key): "${subject}" to ${to}`)
    return { success: false, reason: 'no_api_key' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `318 LEGAACY <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    })

    if (error) {
      console.error(`[Email] Error sending "${subject}" to ${to}:`, error)
      return { success: false, error }
    }

    console.log(`[Email] Sent "${subject}" to ${to} (id: ${data?.id})`)
    return { success: true, id: data?.id }
  } catch (error) {
    console.error(`[Email] Exception sending "${subject}" to ${to}:`, error)
    return { success: false, error }
  }
}
