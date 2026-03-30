'use client';

import { useRealtimeAuction } from '@/hooks/useRealtimeAuction';
import RealtimeBidFeed from './RealtimeBidFeed';
import { formatTimeLeft, isEndingCritical, isAntiSnipeActive } from '@/lib/realtime-utils';
import { Clock, TrendingUp, Activity } from 'lucide-react';

interface AuctionRealtimePanelProps {
  auctionId: string;
  antiSnipeMinutes?: number;
  showBidFeed?: boolean;
}

/**
 * Composant complet d'affichage en temps réel d'une enchère
 * Montre:
 * - L'état et temps restant
 * - La mise actuelle
 * - Le nombre d'enchères
 * - Le flux des nouvelles enchères
 */
export default function AuctionRealtimePanel({
  auctionId,
  antiSnipeMinutes = 2,
  showBidFeed = true,
}: AuctionRealtimePanelProps) {
  const auction = useRealtimeAuction(auctionId);

  const timeDisplay = formatTimeLeft(auction.timeLeft);
  const isCritical = isEndingCritical(auction.timeLeft);
  const isAntiSnipe = isAntiSnipeActive(auction.timeLeft, antiSnipeMinutes);

  return (
    <div className="w-full bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Header avec infos principales */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border-b border-zinc-800 p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Mise actuelle */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Mise actuelle
            </p>
            <p className="text-2xl font-bold text-red-500">
              {auction.currentBid.toLocaleString('fr-FR')}€
            </p>
          </div>

          {/* Nombre d'enchères */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Enchères
            </p>
            <p className="text-2xl font-bold text-white">{auction.bidCount}</p>
          </div>

          {/* Temps restant */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Temps
            </p>
            <p
              className={`text-2xl font-bold ${
                isCritical ? 'text-red-500 animate-pulse' : 'text-white'
              }`}
            >
              {timeDisplay}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              auction.status === 'ACTIVE'
                ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                : auction.status === 'ENDING_SOON'
                ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50'
                : auction.status === 'ENDED' || auction.status === 'COMPLETED'
                ? 'bg-gray-900/30 text-gray-400 border border-gray-700/50'
                : 'bg-blue-900/30 text-blue-400 border border-blue-700/50'
            }`}
          >
            {auction.status}
          </span>

          {/* Anti-snipe badge */}
          {isAntiSnipe && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-700/50 animate-pulse">
              <TrendingUp className="w-3 h-3" />
              Anti-Snipe Actif
            </span>
          )}

          {/* Updating indicator */}
          {auction.isUpdating && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-700/50">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              Mise à jour...
            </span>
          )}
        </div>
      </div>

      {/* Bid Feed */}
      {showBidFeed && (
        <div className="border-t border-zinc-800">
          <RealtimeBidFeed
            auctionId={auctionId}
            maxDisplay={8}
            showSound={true}
            soundUrl="/sounds/bid-notification.mp3"
          />
        </div>
      )}

      {/* Ended state */}
      {auction.timeLeft === 0 && (
        <div className="border-t border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <p className="text-sm text-gray-400 text-center">
            Cette enchère est{' '}
            <span className="font-semibold text-white">terminée</span>
          </p>
        </div>
      )}
    </div>
  );
}
