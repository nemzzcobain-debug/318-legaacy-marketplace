# Supabase Realtime Setup - 318 LEGAACY Marketplace

Implémentation des mises à jour en temps réel des enchères via **Supabase Realtime** (remplace Socket.io qui n'est pas compatible avec Vercel Serverless).

## Architecture

### Composants créés

1. **`src/lib/supabase-client.ts`**
   - Client Supabase côté client (navigateur)
   - Singleton pour éviter les multiples instances
   - Utilise la clé anon pour les subscriptions realtime
   - Configuration optimisée pour realtime (10 events/sec)

2. **`src/hooks/useRealtimeAuction.ts`**
   - `useRealtimeAuction(auctionId)`: Subscribe aux changements d'enchère
   - `useRealtimeBids(auctionId, onNewBid?)`: Subscribe aux nouvelles enchères
   - Gestion du cleanup automatique
   - Calcul du temps restant

3. **`src/components/auction/RealtimeBidFeed.tsx`**
   - Affiche le flux des enchères en direct
   - Animations CSS fade-in pour les nouvelles enchères
   - Support des sons de notification
   - Design dark theme avec accents rouges
   - Affichage des informations utilisateur et type de licence

4. **`src/lib/realtime-utils.ts`**
   - Utilitaires pour les notifications (son, vibration, desktop)
   - Formatage du temps, prix, commission
   - Helpers pour déterminer l'état de l'enchère

5. **`.env.example`**
   - Nouvelles variables: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Configuration

### Variables d'environnement requises

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://onfwowxfflnijuvpspkq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Installation

```bash
npm install @supabase/supabase-js@^2.39.0

# Ensuite déployer le code
npm run build
```

## Utilisation

### Hook `useRealtimeAuction`

Affiche l'état actuel de l'enchère avec mises à jour temps réel:

```tsx
'use client';

import { useRealtimeAuction } from '@/hooks/useRealtimeAuction';

export default function AuctionDetails({ auctionId }: { auctionId: string }) {
  const { currentBid, bidCount, status, timeLeft, isUpdating } =
    useRealtimeAuction(auctionId);

  return (
    <div>
      <p>Mise actuelle: {currentBid}€</p>
      <p>Enchères: {bidCount}</p>
      <p>Temps restant: {timeLeft}ms</p>
      <p>Statut: {status}</p>
    </div>
  );
}
```

### Hook `useRealtimeBids`

Affiche les nouvelles enchères au fur et à mesure:

```tsx
'use client';

import { useRealtimeBids } from '@/hooks/useRealtimeAuction';

export default function BidList({ auctionId }: { auctionId: string }) {
  const bids = useRealtimeBids(auctionId, (newBid) => {
    console.log('Nouvelle enchère:', newBid);
    // Jouer un son, vibrer, notification, etc.
  });

  return (
    <ul>
      {bids.map(bid => (
        <li key={bid.id}>
          {bid.user.displayName}: {bid.finalAmount}€ ({bid.licenseType})
        </li>
      ))}
    </ul>
  );
}
```

### Composant `RealtimeBidFeed`

Composant clé en main avec animations et notifications:

```tsx
'use client';

import RealtimeBidFeed from '@/components/auction/RealtimeBidFeed';

export default function AuctionPage({ auctionId }: { auctionId: string }) {
  return (
    <div className="h-96">
      <RealtimeBidFeed
        auctionId={auctionId}
        maxDisplay={5}
        showSound={true}
        soundUrl="/sounds/bid-notification.mp3"
      />
    </div>
  );
}
```

## Fonctionnalités Realtime

### 1. Mises à jour d'enchère

**Table:** `Auction`
**Events:** UPDATE
**Filter:** `id=eq.{auctionId}`

Détecte les changements:
- `currentBid`: Mise la plus élevée
- `totalBids`: Nombre d'enchères
- `status`: État (SCHEDULED, ACTIVE, ENDING_SOON, ENDED, COMPLETED, CANCELLED)
- `endTime`: Heure de fin

### 2. Nouvelles enchères

**Table:** `Bid`
**Events:** INSERT
**Filter:** `auctionId=eq.{auctionId}`

Transmet:
- `amount`: Montant offert
- `licenseType`: Type de licence
- `finalAmount`: Montant final après calculs
- `user.displayName`: Nom du parient
- `user.avatar`: Avatar
- `createdAt`: Timestamp

### 3. Cleanup automatique

Les subscriptions sont nettoyées automatiquement:
- À l'unmount du composant
- Pas de memory leaks
- Fermeture propre des canaux

## Optimisations

### Performance
- Singleton client Supabase
- Limit de 10 events/sec par défaut
- Debouncing sur le temps restant
- Affichage limité (maxDisplay) des enchères

### UX
- Animations fade-in en CSS
- Auto-scroll vers les nouvelles enchères
- Formatage des prix, timestamps
- Support des notifications sonores
- Vibration et notifications desktop

### Sécurité
- Authentification via JWT (NextAuth)
- RLS (Row Level Security) sur Supabase
- Clé anon limitée aux subscriptions
- Pas d'accès direct aux données sensibles

## Comparaison Socket.io vs Supabase Realtime

| Critère | Socket.io | Supabase Realtime |
|---------|-----------|-------------------|
| **Vercel Serverless** | ❌ Non supporté | ✅ Supporté |
| **Coût** | Serveur requis | Inclus dans Supabase |
| **Setup** | Complexe (serveur + client) | Simple (client only) |
| **Scalabilité** | Limité (stateful) | Excellent (serverless) |
| **Maintenance** | Haute | Faible |
| **Type de données** | JSON custom | Events PostgreSQL |
| **Auth** | Custom | NextAuth + JWT |

## Déploiement sur Vercel

1. Ajouter les variables d'environnement dans Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Build:
   ```bash
   npm run build
   ```

3. Déployer:
   ```bash
   git push  # Via GitHub auto-deploy
   ```

## Configuration Supabase

### Activer Realtime

Dans Supabase Console:
1. Aller à `Realtime` > `Topics`
2. S'assurer que `Auction` et `Bid` sont activées
3. Vérifier les permissions RLS

### RLS (Row Level Security)

Exemple de policy pour Bid:

```sql
-- Tout le monde peut lire les enchères
CREATE POLICY "Bids are publicly readable"
ON public.bid FOR SELECT
USING (true);

-- Seul l'utilisateur authentifié peut créer une enchère
CREATE POLICY "Users can create bids"
ON public.bid FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

## Debugging

### Vérifier les subscriptions

```typescript
import { getSupabaseClient } from '@/lib/supabase-client';

const supabase = getSupabaseClient();
supabase.realtime.subscriptions.forEach(sub => {
  console.log('Channel:', sub.topic);
  console.log('State:', sub.state);
});
```

### Logs realtime

```typescript
const channel = supabase
  .channel('debug')
  .on('*', payload => {
    console.log('Payload:', payload);
  })
  .subscribe((status) => {
    console.log('Channel status:', status);
  });
```

## Support et dépannage

### Enchères ne se mettent pas à jour

1. Vérifier les logs du navigateur
2. Vérifier que Realtime est activé dans Supabase
3. Vérifier les variables d'environnement
4. Vérifier les permissions RLS

### Pas de notifications sonores

1. Vérifier que `/sounds/bid-notification.mp3` existe
2. Vérifier les permissions audio du navigateur
3. Vérifier la console pour les erreurs CORS

### Consommation de ressources élevée

1. Augmenter le `maxDisplay` n'aide pas la perfo
2. Réduire le nombre de subscriptions
3. Vérifier les memory leaks dans React Devtools

## Ressources

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [NextAuth with Supabase](https://supabase.com/docs/guides/auth/social-auth/auth0)
