# Quick Start - Supabase Realtime

Démmarrage rapide avec les mises à jour en temps réel.

## 1. Installation (1 minute)

```bash
npm install
```

## 2. Configuration (.env)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://onfwowxfflnijuvpspkq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Obtenir la clé: [Supabase Console](https://app.supabase.com/) > Project > Settings > API > Anon Key

## 3. Utilisation basique (2 minutes)

### Simple coundown timer + bid count:

```tsx
'use client';

import { useRealtimeAuction } from '@/hooks/useRealtimeAuction';

export default function AuctionWidget({ auctionId }: { auctionId: string }) {
  const { currentBid, bidCount, timeLeft } = useRealtimeAuction(auctionId);

  return (
    <div className="bg-zinc-900 p-4 rounded">
      <p>Mise actuelle: {currentBid}€</p>
      <p>Enchères: {bidCount}</p>
      <p>Temps: {Math.floor(timeLeft / 1000)}s</p>
    </div>
  );
}
```

### Afficher le flux des enchères:

```tsx
'use client';

import RealtimeBidFeed from '@/components/auction/RealtimeBidFeed';

export default function BidList({ auctionId }: { auctionId: string }) {
  return (
    <div className="h-96">
      <RealtimeBidFeed auctionId={auctionId} maxDisplay={5} />
    </div>
  );
}
```

### Composant complet:

```tsx
'use client';

import AuctionRealtimePanel from '@/components/auction/AuctionRealtimePanel';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div className="w-96">
      <AuctionRealtimePanel auctionId={params.id} />
    </div>
  );
}
```

## 4. Tester (2 minutes)

```bash
npm run dev
# Ouvrir http://localhost:3000/auctions/[auctionId]
```

Placer une enchère depuis la DB Supabase pour voir les mises à jour en direct.

## 5. Déployer sur Vercel (5 minutes)

1. Ajouter les variables d'environnement dans Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. Push sur GitHub:
   ```bash
   git add .
   git commit -m "Add Supabase Realtime"
   git push
   ```

3. Vercel déploie automatiquement

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/lib/supabase-client.ts` | Client Supabase singleton |
| `src/hooks/useRealtimeAuction.ts` | Hooks pour subscribe |
| `src/components/auction/RealtimeBidFeed.tsx` | Composant prêt à l'emploi |
| `src/components/auction/AuctionRealtimePanel.tsx` | Panneau complet |
| `src/lib/realtime-utils.ts` | Utilitaires |

## API

### `useRealtimeAuction(auctionId)`

```typescript
const { currentBid, bidCount, status, timeLeft, isUpdating } = useRealtimeAuction(auctionId);
```

- `currentBid`: number - Mise actuelle
- `bidCount`: number - Nombre d'enchères
- `status`: string - État (ACTIVE, ENDED, etc)
- `timeLeft`: number - Millisecondes restantes
- `isUpdating`: boolean - Mise à jour en cours

### `useRealtimeBids(auctionId, onNewBid?)`

```typescript
const bids = useRealtimeBids(auctionId, (bid) => {
  console.log('Nouvelle enchère:', bid);
});
```

- Returns: Array of bids
- Callback: (bid) => void

### `<RealtimeBidFeed>`

```tsx
<RealtimeBidFeed
  auctionId="auction-123"
  maxDisplay={5}
  showSound={true}
  soundUrl="/sounds/bid.mp3"
/>
```

### `<AuctionRealtimePanel>`

```tsx
<AuctionRealtimePanel
  auctionId="auction-123"
  antiSnipeMinutes={2}
  showBidFeed={true}
/>
```

## Utilitaires

```typescript
import { formatTimeLeft, isEndingCritical, formatPrice } from '@/lib/realtime-utils';

formatTimeLeft(timeLeft); // "2h 30m"
isEndingCritical(timeLeft); // true if < 5 min
formatPrice(100); // "100,00€"
```

## Dépannage

**Les mises à jour ne s'affichent pas?**
1. Vérifier NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env
2. Vérifier dans Supabase Console > Realtime > Topics que Auction et Bid sont activées
3. Vérifier dans navigateur > Console pour les erreurs

**Pas de son?**
1. Vérifier que /sounds/bid-notification.mp3 existe
2. Vérifier les permissions audio du navigateur
3. Vérifier les erreurs CORS

## Documentation complète

- [REALTIME_SETUP.md](./REALTIME_SETUP.md) - Configuration détaillée
- [REALTIME_USAGE_EXAMPLES.md](./REALTIME_USAGE_EXAMPLES.md) - 10 exemples complets
