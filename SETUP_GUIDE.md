# Guide de configuration — 318 LEGAACY Marketplace

Suis ces 3 étapes pour activer le webhook Stripe, le stockage Supabase et le temps réel.

---

## 1. SUPABASE — Storage + Realtime

### Créer les buckets Storage
1. Va sur https://supabase.com/dashboard/project/onfwowxfflnijuvpspkq/storage/buckets
2. Clique **New bucket** → Nom: `beats` → Coche **Public bucket** → Valide
3. Clique **New bucket** → Nom: `covers` → Coche **Public bucket** → Valide

### Récupérer les clés API
1. Va sur https://supabase.com/dashboard/project/onfwowxfflnijuvpspkq/settings/api
2. Copie les valeurs suivantes:

| Variable | Où la trouver |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Déjà connue: `https://onfwowxfflnijuvpspkq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Section "Project API keys" → **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Section "Project API keys" → **service_role** (cliquer Reveal) |

### Activer Realtime
1. Va sur https://supabase.com/dashboard/project/onfwowxfflnijuvpspkq/database/replication
2. Active la réplication pour les tables: **Auction**, **Bid**

---

## 2. STRIPE — Webhook

### Créer l'endpoint webhook
1. Va sur https://dashboard.stripe.com/webhooks (ou Workbench > Webhooks)
2. Clique **Create an event destination** (ou Add destination)
3. Sélectionne **Your account**
4. Coche ces événements:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `account.updated`
5. Clique Continue → **Webhook endpoint**
6. URL de l'endpoint: `https://318-legaacy-marketplace.vercel.app/api/stripe/webhook`
7. Valide et copie le **Signing secret** (`whsec_...`)

| Variable | Valeur |
|----------|--------|
| `STRIPE_WEBHOOK_SECRET` | Le `whsec_...` copié à l'étape 7 |

---

## 3. VERCEL — Variables d'environnement

1. Va sur https://vercel.com/legaacy-projects-projects/318-legaacy-marketplace/settings/environment-variables
2. Ajoute ces variables (Production + Preview):

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://onfwowxfflnijuvpspkq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (copiée depuis Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | (copiée depuis Supabase) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (copié depuis Stripe) |

3. Après avoir ajouté toutes les variables, clique **Redeploy** sur le dernier déploiement

---

## Vérification

- **Webhook Stripe**: Va sur https://dashboard.stripe.com/webhooks → ton endpoint doit apparaître avec status "Enabled"
- **Storage Supabase**: Va sur la page Storage → tu dois voir les buckets `beats` et `covers`
- **Realtime**: Va sur la page Replication → Auction et Bid doivent être cochées
- **Test**: Fais un paiement test sur la marketplace et vérifie que la base se met à jour automatiquement
