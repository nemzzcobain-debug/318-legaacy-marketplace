'use client';

import { useEffect, useRef, useState } from 'react';
import { useRealtimeBids } from '@/hooks/useRealtimeAuction';
import { useAudio } from '@/hooks/useAudio';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BidFeedProps {
  auctionId: string;
  maxDisplay?: number;
  showSound?: boolean;
  soundUrl?: string;
}

interface BidData {
  id?: string;
  amount: number;
  licenseType: string;
  finalAmount: number;
  user: {
    displayName: string;
    avatar?: string;
  };
  createdAt: string;
}

/**
 * Composant affichant le flux en temps réel des nouvelles enchères
 * Utilise des animations et joue un son quand une nouvelle enchère arrive
 */
export default function RealtimeBidFeed({
  auctionId,
  maxDisplay = 5,
  showSound = true,
  soundUrl = '/sounds/bid-notification.mp3',
}: BidFeedProps) {
  const audio = useAudio();
  const [displayedBids, setDisplayedBids] = useState<(BidData & { key: string })[]>([]);
  const bids = useRealtimeBids(auctionId, (newBid) => {
    // Jouer un son quand une nouvelle enchère arrive
    if (showSound) {
      audio.play(auctionId, soundUrl);
    }

    // Ajouter la nouvelle enchère à l'affichage
    const bidWithKey = {
      ...newBid,
      key: `${newBid.id || newBid.createdAt}-${Math.random()}`,
    };

    setDisplayedBids((prev) => {
      const updated = [bidWithKey, ...prev];
      return updated.slice(0, maxDisplay);
    });
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers la dernière enchère
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [displayedBids]);

  // Formater le prix
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Obtenir la couleur de la licence
  const getLicenseColor = (licenseType: string) => {
    switch (licenseType?.toUpperCase()) {
      case 'EXCLUSIVE':
        return 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300';
      case 'PREMIUM':
        return 'bg-orange-900/20 border-orange-700/50 text-orange-300';
      case 'BASIC':
      default:
        return 'bg-gray-800/20 border-gray-700/50 text-gray-300';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white">Flux d'enchères en direct</h3>
        <p className="text-xs text-gray-400 mt-1">
          {displayedBids.length} enchère{displayedBids.length !== 1 ? 's' : ''} récente{displayedBids.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Bids List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{
          scrollBehavior: 'smooth',
        }}
      >
        {displayedBids.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center px-4">
            <p className="text-gray-500 text-sm">
              En attente des premières enchères...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {displayedBids.map((bid, index) => (
              <BidEntry
                key={bid.key}
                bid={bid}
                index={index}
                formatPrice={formatPrice}
                getLicenseColor={getLicenseColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {displayedBids.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950/50 text-xs text-gray-400">
          <span className="text-red-500 font-semibold">
            {formatPrice(displayedBids[0].finalAmount)}
          </span>
          {' '}- Enchère la plus haute
        </div>
      )}
    </div>
  );
}

/**
 * Composant pour afficher une enchère individuelle avec animation
 */
function BidEntry({
  bid,
  index,
  formatPrice,
  getLicenseColor,
}: {
  bid: BidData & { key: string };
  index: number;
  formatPrice: (price: number) => string;
  getLicenseColor: (licenseType: string) => string;
}) {
  const animationDelay = `${index * 50}ms`;

  return (
    <div
      className="px-4 py-3 animate-fadeIn hover:bg-zinc-800/30 transition-colors"
      style={{
        animation: `fadeIn 0.3s ease-in forwards`,
        animationDelay,
        opacity: 0,
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {bid.user.avatar ? (
            <img
              src={bid.user.avatar}
              alt={bid.user.displayName}
              className="w-8 h-8 rounded-full object-cover border border-zinc-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white text-xs font-bold">
              {bid.user.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-white truncate">
              {bid.user.displayName}
            </p>
            <time className="text-xs text-gray-500 flex-shrink-0">
              {formatDistanceToNow(new Date(bid.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </time>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-bold text-red-500">
                {formatPrice(bid.finalAmount)}
              </span>
              {bid.amount !== bid.finalAmount && (
                <span className="text-xs text-gray-500">
                  ({formatPrice(bid.amount)})
                </span>
              )}
            </div>

            {/* License Badge */}
            <span
              className={`text-xs px-2 py-1 rounded border ${getLicenseColor(
                bid.licenseType
              )}`}
            >
              {bid.licenseType?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
