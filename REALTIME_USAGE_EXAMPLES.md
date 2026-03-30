# Exemples d'utilisation - Supabase Realtime

Exemples pratiques pour intégrer les mises à jour en temps réel dans votre application.

## 1. Page d'enchère simple

```tsx
// src/app/auctions/[id]/page.tsx
'use client';

import AuctionRealtimePanel from '@/components/auction/AuctionRealtimePanel';
import BeatCard from '@/components/auction/BeatCard';

export default function AuctionPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Beat info */}
          <div className="lg:col-span-2">
            <BeatCard auctionId={params.id} />
          </div>

          {/* Realtime auction panel */}
          <div className="lg:col-span-1">
            <AuctionRealtimePanel auctionId={params.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 2. Widget de flux d'enchères uniquement

```tsx
// components/auction/BidFeedWidget.tsx
'use client';

import RealtimeBidFeed from '@/components/auction/RealtimeBidFeed';

export default function BidFeedWidget({ auctionId }: { auctionId: string }) {
  return (
    <aside className="w-96 h-screen sticky top-0">
      <RealtimeBidFeed
        auctionId={auctionId}
        maxDisplay={10}
        showSound={true}
      />
    </aside>
  );
}
```

## 3. Alertes personnalisées sur nouvelles enchères

```tsx
// components/auction/BidAlerts.tsx
'use client';

import { useRealtimeBids } from '@/hooks/useRealtimeAuction';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/realtime-utils';

export default function BidAlerts({ auctionId }: { auctionId: string }) {
  useRealtimeBids(auctionId, (newBid) => {
    // Toast notification
    toast.success(`Nouvelle enchère: ${newBid.user.displayName}`, {
      description: formatPrice(newBid.finalAmount),
      duration: 4000,
    });

    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    // Desktop notification
    if (Notification.permission === 'granted') {
      new Notification('Nouvelle enchère', {
        body: `${newBid.user.displayName} a enchéri ${formatPrice(newBid.finalAmount)}`,
        icon: '/logo.png',
      });
    }
  });

  return null;
}
```

## 4. Monitoring de l'état en temps réel

```tsx
// components/auction/AuctionStatusMonitor.tsx
'use client';

import { useRealtimeAuction } from '@/hooks/useRealtimeAuction';
import { formatTimeLeft, isEndingCritical } from '@/lib/realtime-utils';
import { AlertTriangle } from 'lucide-react';

export default function AuctionStatusMonitor({
  auctionId,
}: {
  auctionId: string;
}) {
  const { status, timeLeft } = useRealtimeAuction(auctionId);

  const isCritical = isEndingCritical(timeLeft);
  const timeDisplay = formatTimeLeft(timeLeft);

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 rounded-lg border-2 ${
        isCritical
          ? 'bg-red-950 border-red-500 animate-pulse'
          : 'bg-green-950 border-green-500'
      }`}
    >
      <div className="flex items-center gap-3">
        {isCritical && <AlertTriangle className="w-5 h-5 text-red-500" />}
        <div>
          <p className="font-semibold text-white">{status}</p>
          <p className={isCritical ? 'text-red-400' : 'text-green-400'}>
            {timeDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}
```

## 5. Liste des meilleures enchères

```tsx
// components/auction/TopBidders.tsx
'use client';

import { useRealtimeBids } from '@/hooks/useRealtimeAuction';
import { formatPrice } from '@/lib/realtime-utils';

export default function TopBidders({ auctionId }: { auctionId: string }) {
  const bids = useRealtimeBids(auctionId);

  const topBids = bids.slice(0, 5);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-lg font-bold text-white mb-4">Top Enchères</h3>

      {topBids.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          Aucune enchère pour l'instant
        </p>
      ) : (
        <ol className="space-y-3">
          {topBids.map((bid, index) => (
            <li key={bid.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-red-500 font-bold">#{index + 1}</span>
                {bid.user.avatar && (
                  <img
                    src={bid.user.avatar}
                    alt={bid.user.displayName}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-white">{bid.user.displayName}</span>
              </div>
              <span className="font-bold text-red-500">
                {formatPrice(bid.finalAmount)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

## 6. Composant avec timer et countdown

```tsx
// components/auction/AuctionCountdown.tsx
'use client';

import { useRealtimeAuction } from '@/hooks/useRealtimeAuction';
import { formatTimeLeft, isEndingCritical } from '@/lib/realtime-utils';
import { Clock } from 'lucide-react';

export default function AuctionCountdown({
  auctionId,
}: {
  auctionId: string;
}) {
  const { timeLeft } = useRealtimeAuction(auctionId);

  const isCritical = isEndingCritical(timeLeft);
  const timeDisplay = formatTimeLeft(timeLeft);

  return (
    <div
      className={`p-6 rounded-lg border-2 text-center ${
        isCritical
          ? 'bg-red-950/30 border-red-500 animate-pulse'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <Clock className={isCritical ? 'w-6 h-6 text-red-500' : 'w-6 h-6 text-gray-400'} />
        <p className="text-sm font-semibold text-gray-400 uppercase">
          {isCritical ? 'Fin imminente!' : 'Temps restant'}
        </p>
      </div>

      <p
        className={`text-4xl font-black ${
          isCritical ? 'text-red-500' : 'text-white'
        }`}
      >
        {timeDisplay}
      </p>

      {timeLeft === 0 && (
        <p className="text-sm text-gray-400 mt-4 italic">
          Enchère terminée
        </p>
      )}
    </div>
  );
}
```

## 7. Intégration complète dans une page

```tsx
// src/app/auctions/[id]/layout.tsx
'use client';

import { useSession } from 'next-auth/react';
import AuctionRealtimePanel from '@/components/auction/AuctionRealtimePanel';
import BidAlerts from '@/components/auction/BidAlerts';
import AuctionStatusMonitor from '@/components/auction/AuctionStatusMonitor';

export default function AuctionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { data: session } = useSession();

  return (
    <>
      {/* Realtime updates */}
      {session && <BidAlerts auctionId={params.id} />}
      <AuctionStatusMonitor auctionId={params.id} />

      {/* Main content */}
      <main className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 p-4">
          {/* Beat details */}
          <div className="lg:col-span-3">{children}</div>

          {/* Realtime panel */}
          <aside className="lg:col-span-1">
            <AuctionRealtimePanel
              auctionId={params.id}
              showBidFeed={true}
            />
          </aside>
        </div>
      </main>
    </>
  );
}
```

## 8. Hook personnalisé avec règle métier

```tsx
// hooks/useMyAuctionBids.ts
'use client';

import { useRealtimeBids } from './useRealtimeAuction';
import { useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

export function useMyAuctionBids(auctionId: string) {
  const { data: session } = useSession();
  const [myBids, setMyBids] = useState<any[]>([]);
  const [isOutbid, setIsOutbid] = useState(false);

  useRealtimeBids(auctionId, (newBid) => {
    if (newBid.userId === session?.user?.id) {
      // C'est mon enchère
      setMyBids((prev) => [newBid, ...prev]);
      setIsOutbid(false);
    } else if (
      myBids.length > 0 &&
      newBid.finalAmount > myBids[0].finalAmount
    ) {
      // Je suis surenchéri
      setIsOutbid(true);
    }
  });

  return { myBids, isOutbid };
}
```

## 9. Composant avec permission notifications

```tsx
// components/auction/BidNotifications.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRealtimeBids } from '@/hooks/useRealtimeAuction';
import {
  requestNotificationPermission,
  sendDesktopNotification,
} from '@/lib/realtime-utils';
import { Bell } from 'lucide-react';

export default function BidNotifications({
  auctionId,
}: {
  auctionId: string;
}) {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      const granted = await requestNotificationPermission();
      setHasPermission(granted);
    };

    checkPermission();
  }, []);

  useRealtimeBids(auctionId, (newBid) => {
    if (hasPermission) {
      sendDesktopNotification(
        `${newBid.user.displayName} a enchéri`,
        {
          body: `${newBid.finalAmount}€ - ${newBid.licenseType}`,
          tag: 'bid-notification',
        }
      );
    }
  });

  return hasPermission ? null : (
    <div className="p-3 bg-blue-950 border border-blue-700 rounded-lg flex items-center gap-2">
      <Bell className="w-4 h-4 text-blue-400" />
      <button
        onClick={async () => {
          const granted = await requestNotificationPermission();
          setHasPermission(granted);
        }}
        className="text-sm font-medium text-blue-400 hover:text-blue-300"
      >
        Activer les notifications
      </button>
    </div>
  );
}
```

## 10. Stockage en cache local avec Realtime

```tsx
// hooks/useAuctionCache.ts
'use client';

import { useRealtimeAuction } from './useRealtimeAuction';
import { useEffect } from 'react';

export function useAuctionCache(auctionId: string) {
  const auctionState = useRealtimeAuction(auctionId);

  // Sauvegarder dans localStorage pour la persistance
  useEffect(() => {
    const cached = {
      auctionId,
      ...auctionState,
      timestamp: Date.now(),
    };

    localStorage.setItem(`auction:${auctionId}`, JSON.stringify(cached));
  }, [auctionId, auctionState]);

  return auctionState;
}
```

## Bonnes pratiques

1. **Toujours utiliser 'use client'** pour les composants avec hooks
2. **Limiter le nombre de subscriptions** - une par enchère suffisamment
3. **Nettoyer les subscriptions** - les hooks s'en chargent automatiquement
4. **Ajouter des fallbacks UI** - afficher les données en cache si Realtime échoue
5. **Tester en production** - Realtime peut se comporter différemment localement
6. **Monitorer les erreurs** - logger les erreurs de subscription
7. **Optimiser avec maxDisplay** - ne pas afficher 100 enchères à la fois
