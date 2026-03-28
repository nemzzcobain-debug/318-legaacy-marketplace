# 318 LEGAACY Marketplace - Guide d'installation

## Pre-requis

- **Node.js** v18+ (https://nodejs.org)
- **PostgreSQL** (ou utilise SQLite pour le dev, voir plus bas)
- **npm** ou **yarn**

## Installation rapide

### 1. Installer les dependances

```bash
cd 318-legaacy-app
npm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Edite le fichier `.env` avec tes propres valeurs:

- **DATABASE_URL**: Ta base de donnees
  - PostgreSQL: `postgresql://user:password@localhost:5432/legaacy_marketplace`
  - SQLite (dev rapide): `file:./dev.db` (change aussi `provider = "sqlite"` dans `prisma/schema.prisma`)
- **NEXTAUTH_SECRET**: Genere avec `openssl rand -base64 32`
- **STRIPE_SECRET_KEY**: Depuis https://dashboard.stripe.com/apikeys

### 3. Initialiser la base de donnees

```bash
# Generer le client Prisma
npm run db:generate

# Creer les tables
npm run db:push

# Remplir avec les donnees de test
npm run db:seed
```

### 4. Lancer l'application

```bash
npm run dev
```

Ouvre http://localhost:3000

## Comptes de test

| Role | Email | Mot de passe |
|------|-------|-------------|
| Admin (toi) | admin@318legaacy.fr | Admin318! |
| Artiste | artist@test.com | Test1234! |
| Producteur | shadow@test.com | Test1234! |

## Structure du projet

```
318-legaacy-app/
├── prisma/
│   ├── schema.prisma    # Schema base de donnees
│   └── seed.ts          # Donnees de test
├── src/
│   ├── app/
│   │   ├── api/         # Routes API (backend)
│   │   │   ├── auth/    # Authentification
│   │   │   ├── auctions/# Encheres + bids
│   │   │   ├── beats/   # Gestion des beats
│   │   │   └── producers/# Producteurs + candidatures
│   │   ├── marketplace/ # Page encheres
│   │   ├── producers/   # Page producteurs
│   │   ├── dashboard/   # Dashboard utilisateur
│   │   ├── admin/       # Panel admin
│   │   ├── layout.tsx   # Layout principal
│   │   └── page.tsx     # Page d'accueil
│   ├── components/      # Composants React
│   ├── hooks/           # Hooks custom
│   ├── lib/             # Utilitaires
│   └── types/           # Types TypeScript
└── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Inscription
- `POST /api/auth/nextauth` - Connexion (NextAuth)

### Beats
- `GET /api/beats` - Liste des beats (filtres: genre, mood, search)
- `POST /api/beats` - Creer un beat (producteur)

### Encheres
- `GET /api/auctions` - Liste des encheres (filtres: status, genre, sort)
- `POST /api/auctions` - Creer une enchere (producteur)
- `POST /api/auctions/bid?auctionId=xxx` - Placer une enchere

### Producteurs
- `GET /api/producers` - Liste des producteurs approuves
- `POST /api/producers/apply` - Postuler comme producteur

## Prochaines etapes

1. **Frontend complet** - Pages marketplace, detail encheres, dashboard
2. **Stripe Connect** - Paiements et split commission
3. **WebSocket** - Encheres temps reel avec Socket.io
4. **Upload audio** - Stockage des fichiers beats
5. **Deploiement** - Vercel / Railway / VPS
