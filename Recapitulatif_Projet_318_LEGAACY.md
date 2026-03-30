# Récapitulatif complet du projet — 318 LEGAACY

**Projet :** 318 LEGAACY Studio + Marketplace d'enchères de beats
**Gérant :** LEGACY (Moussa Doumbia)
**Période :** 24 mars – 28 mars 2026
**Studio :** 45 rue Délizy, 93500 Pantin

---

## Phase 1 — Onboarding et configuration (24 mars)

### Personnalisation de Claude comme assistant du studio

On a configuré Claude comme assistant quotidien du 318 LEGAACY Studio. Tout a commencé par un diagnostic complet de la situation :

**Équipe d'ingénieurs du son identifiée :** Ghost, Bony, Saylens, Waza, May, Pvrple Haze, Destiny, KAAZ — soit 8 ingénieurs en rotation jour/nuit.

**Diagnostic du studio :** le planning était largement sous-exploité (seulement ~2 sessions clients par semaine sur un studio ouvert 7j/7 de 10h à 06h). Plusieurs paiements Stripe en échec ou non encaissés. Aucune stratégie marketing active. Concurrence directe identifiée sur la même rue (DGD Music Studio au n°36).

### Templates email professionnels (Gmail)

Création de 5 brouillons Gmail prêts à l'emploi, au design noir/rouge du studio :

1. Confirmation d'enregistrement (durée, ingé son, bouton Stripe, règlement)
2. Confirmation de mixage (standard 150€ WAV/MP3 ou stems 250€)
3. Confirmation de mastering (nombre de titres x 100€)
4. Confirmation de pack d'heures (Pack 17h à 500€ ou Pack 20h à 600€)
5. Rappel de séance (48h avant, avec adresse, conditions, règles)

### Analyse concurrentielle

Recherche des studios concurrents à Pantin et alentours : DGD Music Studio (36 rue Delizy, voisin direct), Urban Mix Master (Pantin, 35€/h), Studiomatic (libre-service dès 12€/h), BHR Prod (hip-hop/reggae), Blasta Studio (Neuilly-sur-Marne).

Conclusion : le problème n'est pas l'offre (équipe solide, prix compétitifs, packs avantageux) mais la visibilité.

### Plan marketing "FILL THE BOOTH"

Création d'un plan de campagne marketing complet en document Word avec :

- Objectif : passer de 2 à 20+ sessions par semaine en 3 mois
- Stratégie réseaux sociaux (Instagram, TikTok)
- Partenariats beatmakers locaux
- Fiche Google Business à créer en priorité
- Calendrier de contenu semaine par semaine
- Budget et KPIs de suivi

### SOP de réservation

Document de procédure standard pour la gestion des réservations du studio : process complet de la demande client jusqu'à la facturation.

---

## Phase 2 — Briefings quotidiens automatiques (24-28 mars)

### Tâche planifiée "Studio Daily Briefing"

Mise en place d'une tâche automatique qui s'exécute chaque matin et génère un briefing quotidien :

- Consultation automatique du Google Calendar
- Identification des ingénieurs en rotation (☀️ jour / 🌙 nuit)
- Liste des sessions clients avec statut paiement (✅ payé, ❌ impayé, ☣️ récurrent)
- Sessions du lendemain pour préparer les rappels J-1
- Points d'attention (paiements sur place, créneaux vides à promouvoir)
- Création automatique d'un brouillon email HTML au design du studio

**Briefings générés :**

- 24 mars : Ghost (jour) / Saylens (nuit), aucune session, créneau vide à combler
- 25 mars : Ghost (jour) / Bony (nuit), 2 sessions (Delta 20h-22h, Abasse 22h-00h)
- 27 mars : Ghost (jour) / Bony (nuit), 3 sessions (Karter 23h-02h, Jasmine 20h-22h, Abasse 22h-00h)
- 28 mars : May (jour) / Pvrple Haze (nuit), sessions à venir

---

## Phase 3 — Application de réservation en ligne (sessions précédentes)

### Création du site vitrine + système de réservation

Développement d'un site web complet pour le studio avec :

- Page d'accueil avec présentation du studio
- Section de réservation interactive en étapes :
  - Étape 1 : choix de la salle
  - Étape 2 : sélecteur de tranche horaire (☀️ Journée 10h-20h / 🌙 Nuit 20h-06h) avec l'ingé correspondant
  - Étape 3 : compteur de personnes (4 incluses, +15€/pers. au-delà) + services (Mix & Master)
- Tarifs : 35€/h sur toutes les salles
- Mix & Master : 150€ WAV/MP3 ou 250€ STEMS
- Widget Calendly intégré avec effet glow au survol
- Barre de confiance (paiement SSL, confirmation 30 sec, Apple Pay, Stripe)
- Adresse complète avec carte des transports (Métro 5 Hoche, RER E, Tramway T3b, Bus 151/61/249)

### Tentative de liaison Stripe + Google Agenda

On a exploré la connexion automatique entre les paiements Stripe et le Google Calendar pour créer des événements automatiquement. La tâche planifiée a été refusée par le système, donc on a identifié Zapier/Make.com comme solutions alternatives pour une automatisation 24/7.

---

## Phase 4 — Marketplace d'enchères de beats (projet principal)

### Concept

Première plateforme en France de vente d'instrumentales/beats aux enchères en ligne. Modèle marketplace avec commission de 15% sur chaque vente.

### Stack technique

- Frontend/Backend : Next.js 14 (App Router), TypeScript
- Base de données : Prisma ORM, migré de SQLite vers Supabase PostgreSQL pour la production
- Authentification : NextAuth.js (credentials provider)
- Paiements : Stripe Connect (split plateforme/producteur) + PayPal (prévu)
- Déploiement : Vercel (auto-deploy depuis GitHub)
- Design : Tailwind CSS, thème noir/rouge

### Fonctionnalités développées

- Page d'accueil et marketplace avec liste des enchères
- Système d'authentification complet (inscription, connexion, rôles)
- Rôles : Admin, Producteur (nécessite validation), Artiste/Acheteur
- Système d'enchères avec anti-snipe (extension automatique de 2 minutes si enchère dans les dernières secondes)
- Licences multiples avec multiplicateurs de prix : Basic (x1), Premium (x2.5), Exclusive (x10)
- Dashboard producteur avec statistiques (revenus, beats en vente, enchères actives)
- Profils producteurs publics
- Système de notifications
- Messagerie entre utilisateurs
- API routes complètes (auctions, beats, producers, payments, auth)
- Base de données seed avec admin + 3 producteurs + 4 beats + 4 enchères

### Comptes de test

- Admin : admin@318legaacy.fr / Admin318!
- Producteur LEGAACY : nemzzcobain@gmail.com (approuvé)
- Artiste TestArtiste : testartiste318@gmail.com / TestArtiste318!

---

## Phase 5 — Déploiement et tests en production (28 mars — aujourd'hui)

### Résolution du bug d'inscription (erreur 500)

Le endpoint `/api/auth/register` retournait une erreur 500 car les tables n'existaient pas dans Supabase. Prisma ne pouvait pas tourner depuis le sandbox (incompatibilité ARM64), donc toutes les tables ont été créées via l'API Supabase Management directement depuis le navigateur.

**11 tables créées :** User, Account, Session, VerificationToken, Beat, Auction, Bid, Like, Notification, Conversation, Message.

Après cette correction, l'inscription et la connexion fonctionnaient de bout en bout sur la production Vercel.

### Création du contenu de test en production

Insertion directe en base de données via l'API Supabase :

- Beat : "Midnight Trap Vibes" (Trap, 140 BPM, licence BASIC)
- Enchère : démarrée et terminée, prix de départ 25€, mise gagnante 30€
- Bid de TestArtiste sur l'enchère
- TestArtiste défini comme gagnant de l'enchère

### Configuration Stripe Connect

Tentative de configuration du split de paiement via Stripe Connect. Connect a été activé sur l'environnement de test mais sur un compte secondaire au lieu du principal. Pour débloquer les tests, le code checkout a été modifié pour rendre le split Connect optionnel.

### Modification du code checkout (commit GitHub)

Fichier modifié : `src/app/api/payments/checkout/route.ts`

Le code vérifie maintenant si le producteur a un `stripeAccountId` : si oui, il applique le split via `payment_intent_data.transfer_data` (15% commission, 85% producteur) ; sinon, il crée un checkout Stripe simple sans split.

Commit : `5531de4 — fix: make Stripe Connect split optional in checkout`
Méthode : commit via l'éditeur web GitHub (git push bloqué depuis le sandbox)
Déploiement : Vercel auto-deploy en ~35 secondes

### Test du checkout Stripe — RÉUSSI

Connexion en tant que TestArtiste sur la production, appel API `/api/payments/checkout` avec l'enchère gagnée :

- Session Stripe créée avec succès
- Montant : 30€
- Commission plateforme : 4.50€ (15%)
- Payout producteur : 25.50€
- Paiement complété avec carte de test (4242 4242 4242 4242)
- Redirection vers `/dashboard?payment=success&auction=auction_test_001`

### Vérification en base de données

Toutes les données correctes en base Supabase : status ENDED, finalPrice 30€, commissionAmount 4.5€, producerPayout 25.5€, winnerId = TestArtiste.

Les champs `stripePaymentId` et `paidAt` sont encore à NULL car le webhook Stripe n'est pas encore configuré.

---

## Ce qui reste à faire

### Priorité haute

1. **Configurer le webhook Stripe** — Créer un endpoint dans le dashboard Stripe test pointant vers `https://318-legaacy-marketplace.vercel.app/api/stripe/webhook`, ajouter le `STRIPE_WEBHOOK_SECRET` dans Vercel
2. **Activer Stripe Connect sur le bon compte** (acct_1S5qJJFClN0lfWEQ) pour le split de paiement en production
3. **Configurer PayPal** comme moyen de paiement alternatif

### Priorité moyenne

4. WebSocket temps réel pour les enchères (mise à jour en direct)
5. Upload audio pour les beats (actuellement URLs placeholder)
6. Panneau admin de validation des producteurs
7. Fiche Google Business pour le studio

### Priorité basse

8. Campagne marketing Instagram/TikTok (plan "FILL THE BOOTH" déjà écrit)
9. Automatisation Stripe → Google Calendar via Zapier
10. Partenariats beatmakers locaux

---

## Infos techniques de référence

| Élément | Valeur |
|---------|--------|
| URL production | https://318-legaacy-marketplace.vercel.app |
| GitHub repo | nemzzcobain-debug/318-legaacy-marketplace |
| Vercel project | legaacy-projects-projects/318-legaacy-marketplace |
| Supabase project | onfwowxfflnijuvpspkq |
| Stripe account | acct_1S5qJJFClN0lfWEQ (LEGAACY STUDIO) |
| Commission | 15% sur chaque vente |
| Adresse studio | 45 rue Délizy, 93500 Pantin |

---

*Document généré le 28 mars 2026*
