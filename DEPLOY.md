<!-- Deploy trigger: initial Vercel deployment -->
# 318 LEGAACY Marketplace — Guide de Deploiement

## Stack Production
- **Hosting**: Vercel (Next.js optimise)
- **Base de donnees**: Supabase (PostgreSQL)
- **Paiements**: Stripe Connect
- **Domaine**: A configurer

---

## Etape 1 : Creer un projet Supabase

1. Va sur [supabase.com](https://supabase.com) et cree un compte
2. Clique **New Project**
3. Choisis un nom (ex: `318-legaacy-marketplace`)
4. Region: **West EU (Ireland)** pour la France
5. Note le **mot de passe** de la base de donnees
6. Attends que le projet soit pret

### Recuperer les URLs de connexion

1. Va dans **Project Settings > Database**
2. Scroll vers **Connection string**
3. Copie les deux URLs :
   - **URI (Transaction/Session)** → c'est ton `DATABASE_URL` (port 6543, avec `?pgbouncer=true`)
   - **URI (Direct)** → c'est ton `DIRECT_URL` (port 5432)
4. Remplace `[YOUR-PASSWORD]` par le mot de passe choisi a l'etape 5

---

## Etape 2 : Pousser le code sur GitHub

```bash
cd ~/Desktop/318\ LEGAACY\ MARKETPLACE/318-legaacy-app

# Initialiser git si pas deja fait
git init
git add .
git commit -m "318 LEGAACY Marketplace - v1.0"

# Creer le repo sur GitHub
gh repo create 318-legaacy-marketplace --private --push
# OU manuellement sur github.com puis :
git remote add origin https://github.com/TON_USERNAME/318-legaacy-marketplace.git
git push -u origin main
```

---

## Etape 3 : Deployer sur Vercel

1. Va sur [vercel.com](https://vercel.com) et connecte-toi avec GitHub
2. Clique **Add New > Project**
3. Importe ton repo `318-legaacy-marketplace`
4. **Framework Preset**: Next.js (detecte automatiquement)

### Configurer les variables d'environnement

Dans Vercel > Project Settings > Environment Variables, ajoute :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | L'URI Transaction de Supabase (port 6543) |
| `DIRECT_URL` | L'URI Direct de Supabase (port 5432) |
| `NEXTAUTH_URL` | `https://ton-domaine.vercel.app` (ou ton domaine custom) |
| `NEXTAUTH_SECRET` | Genere avec `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Ta cle secrete Stripe live |
| `STRIPE_PUBLISHABLE_KEY` | Ta cle publique Stripe live |
| `STRIPE_WEBHOOK_SECRET` | A configurer apres (voir etape 5) |
| `PLATFORM_COMMISSION_PERCENT` | `15` |
| `CRON_SECRET` | Genere un secret unique |

5. Clique **Deploy**

---

## Etape 4 : Initialiser la base de donnees

Apres le premier deploiement, il faut creer les tables dans Supabase.

```bash
# En local, mets les URLs Supabase dans ton .env
# puis :
npx prisma db push
```

Ou directement dans le SQL Editor de Supabase, execute le schema genere par :
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

---

## Etape 5 : Configurer Stripe Webhook

1. Va sur [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Clique **Add endpoint**
3. URL: `https://ton-domaine.vercel.app/api/stripe/webhook`
4. Evenements a ecouter :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
5. Copie le **Signing secret** (whsec_...)
6. Ajoute-le dans Vercel > Environment Variables > `STRIPE_WEBHOOK_SECRET`
7. **Redeploy** le projet

---

## Etape 6 : Configurer un domaine (optionnel)

### Acheter un domaine
- [OVH](https://www.ovh.com/fr/domaines/) (~10€/an pour .com ou .fr)
- [Namecheap](https://www.namecheap.com) (~10$/an)

### Connecter a Vercel
1. Vercel > Project Settings > Domains
2. Ajoute ton domaine (ex: `318legaacy.com`)
3. Vercel te donne les DNS a configurer :
   - Record A: `76.76.21.21`
   - Record CNAME: `cname.vercel-dns.com`
4. Configure ces DNS chez ton registrar
5. Attends la propagation (quelques minutes a 24h)
6. Met a jour `NEXTAUTH_URL` dans Vercel avec le nouveau domaine
7. **Redeploy**

---

## Etape 7 : Cron Job (finalisation des encheres)

Le `vercel.json` configure deja un cron toutes les 5 minutes pour `/api/auctions/finalize`.
Vercel Pro est necessaire pour les cron jobs. En plan gratuit, utilise un service externe :

- [cron-job.org](https://cron-job.org) (gratuit)
- Configure un appel GET vers `https://ton-domaine/api/auctions/finalize`
- Header: `Authorization: Bearer TON_CRON_SECRET`
- Frequence: toutes les 5 minutes

---

## Commandes utiles

```bash
# Voir les logs en production
vercel logs

# Deployer manuellement
vercel --prod

# Ouvrir Prisma Studio (local avec les URLs Supabase)
npx prisma studio

# Migrer la base apres changement de schema
npx prisma db push
```

---

## Checklist finale

- [ ] Supabase projet cree + URLs recuperees
- [ ] Code pousse sur GitHub
- [ ] Vercel connecte + variables configurees
- [ ] Base de donnees initialisee (prisma db push)
- [ ] Stripe webhook configure
- [ ] Domaine connecte (optionnel)
- [ ] Cron job configure
- [ ] Premier test : inscription + creation beat + enchere
