'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import AudioPlayer from '@/components/audio/AudioPlayer';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { useRealtimeAuction, useRealtimeBids } from '@/hooks/useRealtimeAuction';
import { formatTimeLeft, isEndingCritical } from '@/lib/realtime-utils';
import { Gavel, Shield, TrendingUp, Clock, AlertTriangle, Zap, Music, ArrowLeft, Wifi, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface BidItem {
  id: string;
  amount: number;
  finalAmount: number;
  licenseType: string;
  createdAt: string;
  user: { id?: string; name: string; displayName: string | null; avatar: string | null };
}

interface AuctionDetail {
  id: string;
  startPrice: number;
  currentBid: number;
  bidIncrement: number;
  licenseType: string;
  status: string;
  startTime: string;
  endTime: string;
  totalBids: number;
  antiSnipeMinutes: number;
  beat: {
    id: string;
    title: string;
    description: string | null;
    audioUrl: string;
    coverImage: string | null;
    genre: string;
    mood: string | null;
    bpm: number;
    key: string | null;
    tags: string;
    plays: number;
    producer: {
      id: string;
      name: string;
      displayName: string | null;
      avatar: string | null;
      producerStatus: string;
      rating: number;
      totalSales: number;
    };
  };
  bids: BidItem[];
}

const LICENSE_INFO: Record<string, { name: string; color: string; multiplier: number; rights: string }> = {
  BASIC: { name: 'Basic', color: '#8a8a9a', multiplier: 1, rights: 'MP3 - 5000 streams' },
  PREMIUM: { name: 'Premium', color: '#e11d48', multiplier: 2.5, rights: 'WAV + MP3 - 50K streams' },
  EXCLUSIVE: { name: 'Exclusive', color: '#ff0033', multiplier: 10, rights: 'WAV + Stems - Illimite' },
};

export default function AuctionDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const router = useRouter();

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [selectedLicense, setSelectedLicense] = useState('BASIC');
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Realtime hooks
  const realtimeState = useRealtimeAuction(id as string);
  const realtimeBids = useRealtimeBids(id as string, (newBid) => {
    // Flash animation on new bid
    setBidSuccess(`Nouvelle enchere : ${newBid.amount} EUR par ${newBid.user?.displayName || 'Anonyme'}`);
    setTimeout(() => setBidSuccess(''), 4000);
  });

  // Sync realtime state into auction object
  useEffect(() => {
    if (auction && realtimeState.currentBid > 0) {
      setAuction(prev => prev ? {
        ...prev,
        currentBid: realtimeState.currentBid,
        totalBids: realtimeState.bidCount,
        status: realtimeState.status,
      } : prev);
    }
  }, [realtimeState.currentBid, realtimeState.bidCount, realtimeState.status]);

  // Auto-finalize when timer reaches 0 (client-side trigger since Hobby cron is daily)
  const [finalizeCalled, setFinalizeCalled] = useState(false);
  useEffect(() => {
    if (
      realtimeState.timeLeft <= 0 &&
      auction?.status === 'ACTIVE' &&
      !finalizeCalled
    ) {
      setFinalizeCalled(true);
      fetch('/api/auctions/finalize', { method: 'POST' })
        .then(() => fetchAuction())
        .catch(console.error);
    }
  }, [realtimeState.timeLeft, auction?.status, finalizeCalled, fetchAuction]);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAuction(data);
        if (!bidAmount) {
          setBidAmount(String(data.currentBid + data.bidIncrement));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, bidAmount]);

  // Initial load only - realtime handles updates
  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  const placeBid = async () => {
    if (!session) {
      router.push('/login');
      return;
    }

    setBidding(true);
    setBidError('');
    setBidSuccess('');

    try {
      const res = await fetch(`/api/auctions/${id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(bidAmount),
          licenseType: selectedLicense,
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setBidError(data.error);
        return;
      }

      setBidSuccess(`Enchere de ${bidAmount} EUR placee !`);
      setBidAmount(String(data.auction.currentBid + (auction?.bidIncrement || 5)));

      if (data.auction.antiSnipeTriggered) {
        setBidSuccess(prev => prev + ' Anti-snipe active: temps prolonge!');
      }

      // Realtime will handle the update, but also refresh for full bid history
      fetchAuction();
      setTimeout(() => setBidSuccess(''), 5000);
    } catch (e) {
      setBidError('Erreur de connexion');
    } finally {
      setBidding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Enchere introuvable</div>
        </div>
      </div>
    );
  }

  const { beat } = auction;
  const producer = beat.producer;
  const license = LICENSE_INFO[selectedLicense];
  const finalPrice = parseFloat(bidAmount || '0') * license.multiplier;
  const isActive = auction.status === 'ACTIVE' || auction.status === 'ENDING_SOON';
  const isEndingSoon = auction.status === 'ENDING_SOON';
  let parsedTags: string[] = [];
  try { parsedTags = JSON.parse(beat.tags || '[]'); } catch {}

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/marketplace" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white mb-6 transition">
          <ArrowLeft size={14} /> Retour aux encheres
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Left: Beat Info (3 cols) */}
          <div className="lg:col-span-3 space-y-6">

            {/* Beat Header */}
            <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
              {/* Cover gradient */}
              <div className="h-48 bg-gradient-to-br from-[#1a0000] to-[#330011] flex items-center justify-center relative">
                <div className="absolute top-3 left-3 bg-white/10 backdrop-blur-md rounded-full px-3 py-1 text-xs font-semibold text-white">
                  {beat.genre}
                </div>
                {isEndingSoon && (
                  <div className="absolute top-3 right-3 bg-red-600 rounded-full px-3 py-1 text-xs font-bold text-white flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={12} /> ENDING SOON
                  </div>
                )}
                <div className="text-center">
                  <Music size={48} className="text-red-500/50 mx-auto mb-2" />
                  <div className="flex gap-2 justify-center">
                    <span className="bg-black/60 rounded-md px-2 py-0.5 text-xs text-gray-300">{beat.bpm} BPM</span>
                    {beat.key && <span className="bg-black/60 rounded-md px-2 py-0.5 text-xs text-gray-300">{beat.key}</span>}
                    {beat.mood && <span className="bg-black/60 rounded-md px-2 py-0.5 text-xs text-gray-300">{beat.mood}</span>}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <h1 className="text-2xl font-black text-white mb-2">{beat.title}</h1>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold text-white">
                    {producer.name[0]}
                  </div>
                  <span className="text-sm text-gray-300">{producer.displayName || producer.name}</span>
                  {producer.producerStatus === 'APPROVED' && <Shield size={14} className="text-red-500" />}
                  <span className="text-xs text-gray-600">({producer.totalSales} ventes)</span>
                </div>

                {beat.description && <p className="text-sm text-gray-400 mb-4">{beat.description}</p>}

                {/* Tags */}
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {parsedTags.map((tag: string) => (
                      <span key={tag} className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audio Player */}
                <AudioPlayer
                  src={beat.audioUrl}
                  title={beat.title}
                  producer={producer.displayName || producer.name}
                  isPlaying={isPlaying}
                  onPlayToggle={() => setIsPlaying(!isPlaying)}
                  accentColor="#e11d48"
                />
              </div>
            </div>

            {/* Bid History */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-red-500" /> Historique des encheres
              </h3>
              {auction.bids.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {auction.bids.map((bid, i) => (
                    <div key={bid.id} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/[0.02]'}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-[10px] font-bold text-white">
                          {bid.user.name[0]}
                        </div>
                        <div>
                          <span className="text-sm text-white font-semibold">{bid.user.displayName || bid.user.name}</span>
                          {i === 0 && <span className="ml-2 text-[10px] text-red-400 font-bold">LEADER</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-white">{bid.amount} EUR</span>
                        <span className="block text-[10px] text-gray-500">{bid.licenseType} • {new Date(bid.createdAt).toLocaleTimeString('fr-FR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-6">Aucune enchere pour le moment. Sois le premier !</p>
              )}
            </div>
          </div>

          {/* Right: Bid Panel (2 cols) */}
          <div className="lg:col-span-2 space-y-4">

            {/* Auction Status Card */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 sticky top-20">

              {/* Realtime indicator */}
              <div className="flex items-center justify-end gap-1.5 mb-2">
                <Wifi size={10} className="text-green-400" />
                <span className="text-[10px] text-green-400 font-medium">Temps reel</span>
              </div>

              {/* Timer */}
              <div className={`flex items-center justify-between mb-4 p-3 rounded-xl ${isEndingCritical(realtimeState.timeLeft) ? 'bg-red-600/10 border border-red-600/30 animate-pulse' : 'bg-white/[0.03] border border-[#222]'}`}>
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <Clock size={14} /> {isActive ? 'Fin dans' : 'Terminee'}
                </span>
                {isActive && (
                  <span className={`text-lg font-mono font-bold ${isEndingCritical(realtimeState.timeLeft) ? 'text-red-500' : 'text-white'}`}>
                    {formatTimeLeft(realtimeState.timeLeft)}
                  </span>
                )}
              </div>

              {/* Current Bid */}
              <div className="text-center mb-5">
                <p className="text-xs text-gray-500 mb-1">Enchere actuelle</p>
                <p className="text-4xl font-black text-red-500">{auction.currentBid} <span className="text-lg">EUR</span></p>
                <p className="text-xs text-gray-500 mt-1">{auction.totalBids} encheres • Debut a {auction.startPrice} EUR</p>
              </div>

              {/* License Selector */}
              {isActive && (
                <>
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Type de licence</p>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(LICENSE_INFO).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedLicense(key)}
                          className={`p-2 rounded-xl text-center border transition ${
                            selectedLicense === key
                              ? 'border-red-500 bg-red-500/10'
                              : 'border-[#222] bg-white/[0.02] hover:border-gray-600'
                          }`}
                        >
                          <p className="text-xs font-bold text-white">{info.name}</p>
                          <p className="text-[10px] text-gray-500">x{info.multiplier}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">{license.rights}</p>
                  </div>

                  {/* Bid Amount */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Ton enchere (EUR)</p>
                    <div className="relative">
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        min={auction.currentBid + auction.bidIncrement}
                        step={auction.bidIncrement}
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-white text-lg font-bold outline-none focus:border-red-500 transition"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        min {auction.currentBid + auction.bidIncrement} EUR
                      </span>
                    </div>
                    {license.multiplier > 1 && (
                      <p className="text-xs text-red-400 mt-1.5">
                        Prix final avec licence {license.name}: <span className="font-bold">{finalPrice.toFixed(2)} EUR</span>
                      </p>
                    )}
                  </div>

                  {/* Anti-snipe info */}
                  <div className="bg-white/[0.02] border border-[#222] rounded-xl p-3 mb-4">
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Zap size={10} className="text-red-500" /> Anti-snipe actif : si tu enchéris dans les {auction.antiSnipeMinutes} dernieres minutes, le temps est prolonge
                    </p>
                  </div>

                  {/* Error / Success */}
                  {bidError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3 text-red-400 text-sm">
                      {bidError}
                    </div>
                  )}
                  {bidSuccess && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-3 text-green-400 text-sm">
                      {bidSuccess}
                    </div>
                  )}

                  {/* Bid Button */}
                  <button
                    onClick={placeBid}
                    disabled={bidding}
                    className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 bg-gradient-to-r from-red-600 to-red-800"
                  >
                    <Gavel size={20} />
                    {bidding ? 'Enchere en cours...' : `Encherir ${bidAmount} EUR`}
                  </button>
                </>
              )}

              {!isActive && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Gavel size={24} className="text-gray-500" />
                  </div>
                  <p className="text-lg font-bold text-white mb-1">Enchere terminee</p>
                  {auction.bids.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-400 mb-4">
                        Gagnant : <span className="text-white font-semibold">{auction.bids[0].user.displayName || auction.bids[0].user.name}</span> — {auction.currentBid} EUR
                      </p>
                      {session?.user && (session.user as any).id === auction.bids[0].user?.id && (
                        <button
                          onClick={() => router.push(`/checkout/${auction.id}`)}
                          className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-gradient-to-r from-green-600 to-green-800"
                        >
                          <CreditCard size={20} /> Proceder au paiement
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Aucune enchere placee</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
