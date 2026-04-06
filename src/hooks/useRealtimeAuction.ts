'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase-client';

export interface RealtimeAuctionState {
  currentBid: number;
  bidCount: number;
  status: string;
  timeLeft: number;
  isUpdating: boolean;
}

interface AuctionData {
  currentBid: number;
  totalBids: number;
  status: string;
  endTime: string;
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
 * Hook pour s'abonner aux mises à jour en temps réel d'une enchère
 * @param auctionId - ID de l'enchère
 * @returns État de l'enchère (mise actuelle, nombre d'enchères, statut, temps restant)
 */
export function useRealtimeAuction(auctionId: string) {
  const supabase = getSupabaseClient();
  const [state, setState] = useState<RealtimeAuctionState>({
    currentBid: 0,
    bidCount: 0,
    status: 'SCHEDULED',
    timeLeft: 0,
    isUpdating: false,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculer le temps restant
  const updateTimeLeft = useCallback((endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = Math.max(0, end.getTime() - now.getTime());

    setState((prev) => ({
      ...prev,
      timeLeft: diff,
    }));

    return diff;
  }, []);

  // Charger l'enchère initiale
  useEffect(() => {
    const loadAuction = async () => {
      try {
        setState((prev) => ({ ...prev, isUpdating: true }));

        const { data, error } = await supabase
          .from('Auction')
          .select('currentBid, totalBids, status, endTime')
          .eq('id', auctionId)
          .single();

        if (error) {
          console.error('Erreur lors du chargement de l\'enchère:', error);
          return;
        }

        if (data) {
          const auctionData = data as AuctionData;
          setState((prev) => ({
            ...prev,
            currentBid: auctionData.currentBid,
            bidCount: auctionData.totalBids,
            status: auctionData.status,
          }));

          updateTimeLeft(auctionData.endTime);
        }
      } catch (err) {
        console.error('Erreur lors du chargement de l\'enchère:', err);
      } finally {
        setState((prev) => ({ ...prev, isUpdating: false }));
      }
    };

    loadAuction();
  }, [auctionId, supabase, updateTimeLeft]);

  // S'abonner aux changements de l'enchère
  useEffect(() => {
    const channel = supabase
      .channel(`auction:${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Auction',
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          const data = payload.new as AuctionData;
          setState((prev) => ({
            ...prev,
            currentBid: data.currentBid,
            bidCount: data.totalBids,
            status: data.status,
          }));
          updateTimeLeft(data.endTime);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [auctionId, supabase, updateTimeLeft]);

  // Mettre à jour le temps restant chaque seconde
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setState((prev) => {
        const newTimeLeft = Math.max(0, prev.timeLeft - 1000);
        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return state;
}

/**
 * Hook pour s'abonner aux nouvelles enchères en temps réel
 * @param auctionId - ID de l'enchère
 * @param onNewBid - Callback appelé quand une nouvelle enchère est reçue
 * @returns Tableau des nouvelles enchères
 */
export function useRealtimeBids(
  auctionId: string,
  onNewBid?: (bid: BidData) => void
) {
  const supabase = getSupabaseClient();
  const [bids, setBids] = useState<BidData[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // S'abonner aux INSERT events sur la table Bid
    const channel = supabase
      .channel(`bids:${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Bid',
          filter: `auctionId=eq.${auctionId}`,
        },
        (payload) => {
          const newBid = payload.new as unknown;

          // Charger les détails de l'utilisateur
          loadBidWithUser(newBid).then((bidWithUser) => {
            if (bidWithUser) {
              setBids((prev) => [bidWithUser, ...prev]);
              onNewBid?.(bidWithUser);
            }
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [auctionId, supabase, onNewBid]);

  return bids;
}

/**
 * Charger les détails d'une enchère avec les infos utilisateur
 */
async function loadBidWithUser(bidData: unknown): Promise<BidData | null> {
  try {
    const bid = bidData as BidData & { userId?: string };

    if (!bid.userId) {
      return bid as BidData;
    }

    const supabase = getSupabaseClient();
    // Utiliser la vue sécurisée PublicUser au lieu de la table User
    // pour ne jamais exposer les champs sensibles (passwordHash, email, etc.)
    const { data: userData } = await supabase
      .from('PublicUser')
      .select('displayName, avatar')
      .eq('id', bid.userId)
      .single();

    return {
      ...bid,
      user: userData || { displayName: 'Anonyme' },
    };
  } catch (err) {
    console.error('Erreur lors du chargement des détails de l\'enchère:', err);
    return null;
  }
}
