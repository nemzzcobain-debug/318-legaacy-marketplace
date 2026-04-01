'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Play, Pause, SkipForward, SkipBack, Music, Globe, Lock,
  Trash2, Share2, Loader2, Gavel, Clock, ListMusic, Volume2
} from 'lucide-react'

interface BeatInPlaylist {
  id: string
  position: number
  beat: {
    id: string; title: string; coverImage: string | null; genre: string; bpm: number
    key: string | null; mood: string | null; duration: number | null; audioUrl: string; plays: number
    producer: { id: string; name: string; displayName: string | null; avatar: string | null }
    auctions: { id: string; currentBid: number; endTime: string; status: string }[]
  }
}

interface PlaylistDetail {
  id: string; name: string; description: string | null; visibility: string
  coverImage: string | null; createdAt: string
  user: { id: string; name: string; displayName: string | null; avatar: string | null }
  beats: BeatInPlaylist[]
  _count: { beats: number }
}

export default function PlaylistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id
  const audioRef = useRef<HTMLAudioElement>(null)

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    fetchPlaylist()
  }, [params.id])

  async function fetchPlaylist() {
    try {
      const res = await fetch(`/api/playlists/${params.id}`)
      if (!res.ok) { router.push('/playlists'); return }
      const data = await res.json()
      setPlaylist(data)
    } catch { router.push('/playlists') }
    finally { setLoading(false) }
  }

  function playTrack(index: number) {
    if (!playlist || !audioRef.current) return
    const beat = playlist.beats[index]?.beat
    if (!beat) return

    if (currentTrack === index && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    audioRef.current.src = beat.audioUrl
    audioRef.current.play().catch(() => {})
    setCurrentTrack(index)
    setIsPlaying(true)
  }

  function nextTrack() {
    if (!playlist) return
    const next = currentTrack + 1 < playlist.beats.length ? currentTrack + 1 : 0
    playTrack(next)
  }

  function prevTrack() {
    if (!playlist) return
    const prev = currentTrack - 1 >= 0 ? currentTrack - 1 : playlist.beats.length - 1
    playTrack(prev)
  }

  async function removeBeat(beatId: string) {
    if (!playlist) return
    try {
      await fetch(`/api/playlists/${playlist.id}/beats`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatId }),
      })
      setPlaylist(prev => prev ? {
        ...prev,
        beats: prev.beats.filter(b => b.beat.id !== beatId),
        _count: { beats: prev._count.beats - 1 },
      } : prev)
    } catch (err) { console.error(err) }
  }

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: playlist?.name, url })
    } else {
      navigator.clipboard.writeText(url)
      alert('Lien copié !')
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateProgress = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const handleEnded = () => nextTrack()

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [currentTrack, playlist])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={40} /></div>
  }

  if (!playlist) return null

  const isOwner = userId === playlist.user.id
  const currentBeat = currentTrack >= 0 ? playlist.beats[currentTrack]?.beat : null

  const genreColors: Record<string, string> = {
    'Trap': 'bg-purple-500/20 text-purple-400', 'Drill': 'bg-red-500/20 text-red-400',
    'Boom Bap': 'bg-yellow-500/20 text-yellow-400', 'R&B': 'bg-pink-500/20 text-pink-400',
    'Afrobeat': 'bg-green-500/20 text-green-400', 'Pop': 'bg-blue-500/20 text-blue-400',
  }

  return (
    <div className="min-h-screen pb-32">
      <audio ref={audioRef} />

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-[#0a0a0f]" />
        <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-6">
          <Link href="/playlists" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={16} /> Retour aux playlists
          </Link>

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover */}
            <div className="w-48 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] shrink-0">
              {playlist.beats.length > 0 ? (
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="relative overflow-hidden">
                      {playlist.beats[i]?.beat.coverImage ? (
                        <img src={playlist.beats[i].beat.coverImage!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center"><Music size={16} className="text-gray-700" /></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ListMusic size={64} className="text-gray-700" /></div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${playlist.visibility === 'PUBLIC' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                  {playlist.visibility === 'PUBLIC' ? <Globe size={10} /> : <Lock size={10} />}
                  {playlist.visibility === 'PUBLIC' ? 'Public' : 'Privé'}
                </span>
              </div>
              <h1 className="text-3xl font-black mb-2">{playlist.name}</h1>
              {playlist.description && <p className="text-sm text-gray-400 mb-3">{playlist.description}</p>}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <Link href={`/producer/${playlist.user.id}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-[9px] font-bold text-white">
                    {(playlist.user.displayName || playlist.user.name)?.[0]}
                  </div>
                  {playlist.user.displayName || playlist.user.name}
                </Link>
                <span>{playlist._count.beats} beat{playlist._count.beats !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex items-center gap-3 mt-5">
                {playlist.beats.length > 0 && (
                  <button
                    onClick={() => playTrack(0)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-transform hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                  >
                    <Play size={18} fill="white" /> Tout lire
                  </button>
                )}
                <button onClick={handleShare} className="p-2.5 glass rounded-xl hover:bg-white/10 transition-colors">
                  <Share2 size={18} className="text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        {playlist.beats.length === 0 ? (
          <div className="text-center py-16">
            <Music size={48} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Cette playlist est vide</p>
            <p className="text-xs text-gray-600 mt-1">Ajoute des beats depuis la marketplace</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header row */}
            <div className="grid grid-cols-[40px_1fr_100px_80px_60px] gap-3 px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <span>#</span>
              <span>Titre</span>
              <span>Genre</span>
              <span>BPM</span>
              <span></span>
            </div>

            {playlist.beats.map((item, index) => {
              const beat = item.beat
              const isActive = currentTrack === index
              const activeAuction = beat.auctions[0]

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[40px_1fr_100px_80px_60px] gap-3 items-center px-4 py-3 rounded-xl transition-colors cursor-pointer group ${
                    isActive ? 'bg-red-500/10 border border-red-500/20' : 'hover:bg-white/5'
                  }`}
                  onClick={() => playTrack(index)}
                >
                  {/* # / Play */}
                  <div className="flex items-center justify-center">
                    {isActive && isPlaying ? (
                      <Volume2 size={16} className="text-red-500 animate-pulse" />
                    ) : (
                      <span className="text-sm text-gray-500 group-hover:hidden">{index + 1}</span>
                    )}
                    <Play size={14} className="text-white hidden group-hover:block" fill="white" />
                  </div>

                  {/* Title + Producer */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a1a2e] shrink-0">
                      {beat.coverImage ? (
                        <img src={beat.coverImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Music size={16} className="text-gray-700" /></div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isActive ? 'text-red-400' : 'text-white'}`}>{beat.title}</p>
                      <Link href={`/producer/${beat.producer.id}`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors" onClick={e => e.stopPropagation()}>
                        {beat.producer.displayName || beat.producer.name}
                      </Link>
                    </div>
                  </div>

                  {/* Genre */}
                  <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${genreColors[beat.genre] || 'bg-gray-500/20 text-gray-400'}`}>
                    {beat.genre}
                  </span>

                  {/* BPM */}
                  <span className="text-xs text-gray-500">{beat.bpm} BPM</span>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {activeAuction && (
                      <Link href={`/auction/${activeAuction.id}`} className="p-1 hover:bg-white/10 rounded-lg" title="Voir l'enchère">
                        <Gavel size={14} className="text-red-400" />
                      </Link>
                    )}
                    {isOwner && (
                      <button onClick={() => removeBeat(beat.id)} className="p-1 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} className="text-gray-600 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Player bar */}
      {currentBeat && (
        <div className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-[#1e1e2e]">
          {/* Progress bar */}
          <div className="h-1 bg-[#1e1e2e]">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Track info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                {currentBeat.coverImage ? (
                  <img src={currentBeat.coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center"><Music size={16} className="text-gray-700" /></div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{currentBeat.title}</p>
                <p className="text-xs text-gray-500 truncate">{currentBeat.producer.displayName || currentBeat.producer.name}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={prevTrack} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <SkipBack size={18} className="text-gray-400" />
              </button>
              <button
                onClick={() => playTrack(currentTrack)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                {isPlaying ? <Pause size={18} fill="white" className="text-white" /> : <Play size={18} fill="white" className="text-white" />}
              </button>
              <button onClick={nextTrack} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <SkipForward size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="w-20" />
          </div>
        </div>
      )}
    </div>
  )
}
