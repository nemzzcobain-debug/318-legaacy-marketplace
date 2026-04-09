/**
 * BPM Agent - Knowledge Base & AI Logic
 * Handles 80-90% of simple questions about 318 LEGAACY Marketplace
 * Escalates to WhatsApp when confidence < 70% or sensitive topics detected
 */

export const WHATSAPP_NUMBER = '+33766364887'
export const WHATSAPP_LINK = `https://wa.me/33766364887`

// ─── Sensitive Keywords → Immediate WhatsApp Escalation ───
export const SENSITIVE_KEYWORDS = [
  'litige', 'litiges',
  'remboursement', 'rembourser', 'remboursé',
  'problème', 'probleme', 'problemes', 'problèmes',
  'arnaque', 'arnaques', 'arnaqué', 'escroquerie',
  'droits', 'droit d\'auteur', 'copyright',
  'contrat', 'contrats', 'contractuel',
  'licence exclusive', 'exclusivité', 'exclusif',
  'avocat', 'juridique', 'tribunal', 'plainte',
  'vol', 'volé', 'plagiat',
  'fraude', 'frauduleux',
]

// ─── Knowledge Base ───
interface KnowledgeEntry {
  keywords: string[]
  question: string
  answer: string
  confidence: number
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── Général ──
  {
    keywords: ['quoi', 'c\'est quoi', 'marketplace', 'plateforme', 'site', 'présentation', 'description'],
    question: "C'est quoi 318 LEGAACY Marketplace ?",
    answer: "318 LEGAACY Marketplace est la première plateforme d'enchères d'instrumentales (beats) en France. Les producteurs (beatmakers) mettent leurs beats aux enchères, et les artistes peuvent enchérir en temps réel pour acquérir des instrumentales uniques.",
    confidence: 95,
  },
  {
    keywords: ['comment', 'fonctionne', 'marche', 'utiliser', 'fonctionnement'],
    question: "Comment fonctionne le site ?",
    answer: "C'est simple :\n1. **Inscris-toi** (gratuit) en tant qu'Artiste ou Beatmaker\n2. **Explore** les beats disponibles aux enchères\n3. **Enchéris** sur les beats qui te plaisent\n4. **Gagne l'enchère** et télécharge ton beat\n\nLes producteurs peuvent uploader leurs beats et lancer des enchères avec un prix de départ.",
    confidence: 95,
  },

  // ── Inscription / Compte ──
  {
    keywords: ['inscription', 'inscrire', 'créer compte', 'register', 'compte', 'enregistrer', 'google'],
    question: "Comment créer un compte ?",
    answer: "Tu peux t'inscrire de deux façons :\n• **Avec Google** : clique sur \"S'inscrire avec Google\" (rapide et sécurisé)\n• **Par email** : remplis le formulaire avec ton pseudo, email et mot de passe\n\nL'inscription est 100% gratuite !",
    confidence: 95,
  },
  {
    keywords: ['connexion', 'connecter', 'login', 'mot de passe', 'password', 'oublié'],
    question: "Comment se connecter ?",
    answer: "Va sur la page Connexion et utilise soit :\n• **Google** : clique sur \"Continuer avec Google\"\n• **Email + mot de passe** : entre tes identifiants\n\nSi tu as oublié ton mot de passe, clique sur \"Oublié ?\" pour le réinitialiser.",
    confidence: 90,
  },
  {
    keywords: ['artiste', 'acheteur', 'rôle', 'role', 'type'],
    question: "Quelle est la différence entre Artiste et Beatmaker ?",
    answer: "• **Artiste / Acheteur** : Tu peux explorer et enchérir sur des beats. Inscription immédiate.\n• **Beatmaker / Producteur** : Tu peux vendre tes beats aux enchères. Ton compte est vérifié par notre équipe avant activation (sous 24-48h).",
    confidence: 95,
  },

  // ── Enchères ──
  {
    keywords: ['enchère', 'enchere', 'enchérir', 'encherir', 'bid', 'mise', 'miser', 'auction'],
    question: "Comment fonctionnent les enchères ?",
    answer: "Chaque beat a :\n• Un **prix de départ** fixé par le producteur\n• Une **durée** (généralement 7 jours)\n• Un **compte à rebours** en temps réel\n\nTu places ta mise (supérieure à la dernière). Si tu es le plus offrant à la fin, tu gagnes le beat !",
    confidence: 95,
  },
  {
    keywords: ['prix', 'coût', 'cout', 'combien', 'tarif', 'gratuit', 'payant', 'cher'],
    question: "Combien ça coûte ?",
    answer: "• **L'inscription** est gratuite\n• **Le prix des beats** dépend des enchères (prix de départ fixé par le producteur)\n• **Commission** : une petite commission est prélevée sur les ventes\n\nChaque beat a un prix de départ différent, tu décides combien tu veux miser !",
    confidence: 85,
  },
  {
    keywords: ['gagner', 'remporter', 'victoire', 'gagnant', 'winner', 'win'],
    question: "Comment gagner une enchère ?",
    answer: "Pour gagner, tu dois être le **plus offrant** quand le compte à rebours arrive à zéro. Conseil : surveille les enchères qui t'intéressent et place ta mise stratégiquement. Tu recevras une notification si quelqu'un surenchérit.",
    confidence: 90,
  },

  // ── Paiement ──
  {
    keywords: ['payer', 'paiement', 'payment', 'carte', 'bancaire', 'stripe', 'visa', 'mastercard'],
    question: "Comment payer ?",
    answer: "Les paiements sont sécurisés via **Stripe** (leader mondial du paiement en ligne). Tu peux payer par :\n• Carte bancaire (Visa, Mastercard)\n• Les transactions sont cryptées et sécurisées.",
    confidence: 90,
  },
  {
    keywords: ['sécurité', 'securite', 'sécurisé', 'securise', 'fiable', 'confiance', 'safe'],
    question: "Le site est-il sécurisé ?",
    answer: "Oui, 318 LEGAACY Marketplace utilise :\n• **HTTPS** (connexion cryptée)\n• **Stripe** pour les paiements (certifié PCI DSS)\n• **Authentification sécurisée** (Google OAuth + email vérifié)\n• Tous les producteurs sont **vérifiés** par notre équipe.",
    confidence: 95,
  },

  // ── Producteur / Vente ──
  {
    keywords: ['vendre', 'vente', 'uploader', 'upload', 'mettre en vente', 'poster', 'publier', 'producteur', 'beatmaker'],
    question: "Comment vendre mes beats ?",
    answer: "1. **Inscris-toi** en tant que Beatmaker / Producteur\n2. **Attends la validation** de ton compte (24-48h)\n3. **Upload tes beats** avec artwork, tags et description\n4. **Lance une enchère** avec ton prix de départ\n\nTu reçois le paiement directement après la vente !",
    confidence: 90,
  },
  {
    keywords: ['validation', 'validé', 'attente', 'pending', 'vérifié', 'verifie', 'vérification', 'verification'],
    question: "Pourquoi mon compte producteur est en attente ?",
    answer: "Pour garantir la qualité, chaque compte producteur est **vérifié manuellement** par notre équipe. Ça prend généralement **24 à 48h**. Tu recevras un email de confirmation une fois validé. Si ça prend plus de temps, contacte-nous !",
    confidence: 90,
  },

  // ── Technique ──
  {
    keywords: ['format', 'qualité', 'wav', 'mp3', 'audio', 'fichier', 'télécharger', 'telecharger', 'download'],
    question: "Quel format pour les beats ?",
    answer: "Les beats sont disponibles en haute qualité :\n• **WAV** (qualité studio, non compressé)\n• **MP3** (pour l'écoute / preview)\n\nAprès avoir gagné une enchère, tu peux télécharger le beat dans le format disponible.",
    confidence: 85,
  },
  {
    keywords: ['langue', 'anglais', 'english', 'français', 'language', 'translation'],
    question: "Le site est en quelle langue ?",
    answer: "Le site est disponible en **français** et en **anglais**. Tu peux changer la langue avec le sélecteur de drapeaux dans la barre de navigation.",
    confidence: 95,
  },

  // ── Contact / Support ──
  {
    keywords: ['contact', 'contacter', 'joindre', 'email', 'mail', 'téléphone', 'telephone', 'support', 'aide', 'help'],
    question: "Comment contacter le support ?",
    answer: "Tu peux nous contacter :\n• **Par ce chat** : je suis là pour t'aider !\n• **Par WhatsApp** : pour les questions complexes, je peux te rediriger vers notre équipe\n• **Par email** : via ton espace membre\n\nNotre équipe répond généralement sous 24h.",
    confidence: 90,
  },

  // ── Salutations ──
  {
    keywords: ['salut', 'bonjour', 'hello', 'hey', 'yo', 'wesh', 'coucou', 'bonsoir', 'hi'],
    question: "Salutation",
    answer: "Salut ! Je suis **BPM**, l'assistant IA de 318 LEGAACY Marketplace. Comment je peux t'aider aujourd'hui ? Tu peux me poser des questions sur :\n• Les enchères de beats\n• Ton compte\n• Les paiements\n• Le fonctionnement du site",
    confidence: 99,
  },
  {
    keywords: ['merci', 'thanks', 'thank', 'remercie', 'super', 'parfait', 'cool', 'top', 'nice'],
    question: "Remerciement",
    answer: "Avec plaisir ! N'hésite pas si tu as d'autres questions. Je suis là pour ça. Bonne visite sur 318 LEGAACY Marketplace !",
    confidence: 99,
  },
]

// ─── Response Logic ───

export interface BPMResponse {
  message: string
  confidence: number
  shouldEscalate: boolean
  escalateReason?: string
}

/**
 * Check if message contains sensitive keywords
 */
export function containsSensitiveKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword
    }
  }
  return null
}

/**
 * Check if message is too long or incomprehensible
 */
export function isMessageProblematic(message: string): { problematic: boolean; reason?: string } {
  // Too long (> 500 chars)
  if (message.length > 500) {
    return { problematic: true, reason: 'Message trop long pour une réponse automatique' }
  }

  // Too short / incomprehensible (< 2 chars)
  if (message.trim().length < 2) {
    return { problematic: true, reason: 'Message incompréhensible' }
  }

  // Lots of special characters (likely gibberish)
  const specialChars = message.replace(/[a-zA-ZÀ-ÿ0-9\s.,!?'"-]/g, '')
  if (specialChars.length > message.length * 0.4) {
    return { problematic: true, reason: 'Message incompréhensible' }
  }

  return { problematic: false }
}

/**
 * Find the best matching knowledge entry
 */
export function findBestMatch(message: string): { entry: KnowledgeEntry | null; matchScore: number } {
  const lower = message.toLowerCase()
  const words = lower.split(/\s+/)

  let bestEntry: KnowledgeEntry | null = null
  let bestScore = 0

  for (const entry of KNOWLEDGE_BASE) {
    let matchCount = 0
    let totalKeywords = entry.keywords.length

    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        matchCount++
        // Bonus for exact word match
        if (words.includes(keyword)) {
          matchCount += 0.5
        }
      }
    }

    const score = (matchCount / totalKeywords) * entry.confidence
    if (score > bestScore) {
      bestScore = score
      bestEntry = entry
    }
  }

  return { entry: bestEntry, matchScore: bestScore }
}

/**
 * Main response function
 */
export function getBPMResponse(message: string): BPMResponse {
  // 1. Check for sensitive keywords
  const sensitiveKeyword = containsSensitiveKeyword(message)
  if (sensitiveKeyword) {
    return {
      message: `Je détecte que ta question concerne un sujet sensible ("${sensitiveKeyword}"). Pour te donner la meilleure aide possible, je vais te rediriger vers notre équipe humaine sur WhatsApp.`,
      confidence: 0,
      shouldEscalate: true,
      escalateReason: `Mot-clé sensible détecté : "${sensitiveKeyword}"`,
    }
  }

  // 2. Check if message is problematic
  const { problematic, reason } = isMessageProblematic(message)
  if (problematic) {
    return {
      message: `Je n'arrive pas bien à comprendre ta demande. Pour t'aider au mieux, je vais te mettre en contact avec notre équipe.`,
      confidence: 0,
      shouldEscalate: true,
      escalateReason: reason,
    }
  }

  // 3. Try to find a match in knowledge base
  const { entry, matchScore } = findBestMatch(message)

  if (entry && matchScore >= 70) {
    return {
      message: entry.answer,
      confidence: matchScore,
      shouldEscalate: false,
    }
  }

  // 4. Partial match (50-69%) - answer but suggest WhatsApp
  if (entry && matchScore >= 50) {
    return {
      message: `${entry.answer}\n\n💡 *Si ma réponse ne correspond pas exactement à ta question, n'hésite pas — je peux te mettre en contact avec notre équipe.*`,
      confidence: matchScore,
      shouldEscalate: false,
    }
  }

  // 5. Low confidence (< 50%) - escalate
  return {
    message: "Je ne suis pas sûr de bien comprendre ta question. Pour te donner une réponse précise, je vais te mettre en contact avec notre équipe.",
    confidence: matchScore,
    shouldEscalate: true,
    escalateReason: `Confiance trop faible (${Math.round(matchScore)}%)`,
  }
}
