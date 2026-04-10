'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
    ListMusic, Plus, Globe, Lock, Music, Trash2, X, Loader2, Search, ArrowLeft
} from 'lucide-react'

interface PlaylistItem {
    id: string
    name: string
    description: string | null
    visibility: string
    coverImage: string | null
    createdAt: string
    updatedAt: string
    user: { id: string; name: string; displayName: string | null; avatar: string | null }
    beats: { beat: { id: string; title: string; coverImage: string | null; genre: string; bpm: number } }[]
    _count: { beats: number }
}

export default function PlaylistsPage() {
    const { data: session } = useSession()

  const [playlists, setPlaylists] = useState<PlaylistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'mine' | 'public'>('mine')
    const [showCreate, setShowCreate] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [newVisibility, setNewVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
    const [creating, setCreating] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
        fetchPlaylists()
  }, [tab])

  async function fetchPlaylists() {
        setLoading(true)
        try {
                const res = await fetch(`/api/playlists?mode=${tab}`)
                if (res.ok) {
                          const data = await res.json()
                          setPlaylists(data)
                }
        } catch (err) {
                console.error(err)
        } finally {
                setLoading(false)
        }
  }

  async function handleCreate() {
        if (!newName.trim()) return
        setCreating(true)
        try {
                const res = await fetch('/api/playlists', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), visibility: newVisibility }),
                })
                if (res.ok) {
                          setShowCreate(false)
                          setNewName('')
                          setNewDesc('')
                          setNewVisibility('PUBLIC')
                          fetchPlaylists()
                }
        } catch (err) {
                console.error(err)
        } finally {
                setCreating(false)
        }
  }

  async function handleDelete(id: string) {
        if (!confirm('Supprimer cette playlist ?')) return
        try {
                await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
                setPlaylists(prev => prev.filter(p => p.id !== id))
        } catch (err) {
                console.error(err)
        }
  }

  const filtered = playlists.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
                                      )

  return (
        <div className="min-h-screen py-8 px-4">
              <div className="max-w-6xl mx-auto">
                {/* Back button */}
                      <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
                                <ArrowLeft size={16} /> Retour au marketplace
                      </Link>Link>
              
                {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                                <div>
                                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                                          <ListMusic className="text-red-500" size={32} />
                                                          Playlists
                                            </h1>h1>
                                            <p className="text-sm text-gray-500 mt-1">Organise tes beats favoris en collections</p>p>
                                </div>div>
                        {session && (
                      <button
                                      onClick={() => setShowCreate(true)}
                                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-transform hover:scale-105"
                                      style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                                    >
                                    <Plus size={18} /> Nouvelle Playlist
                      </button>button>
                                )}
                      </div>div>
              
                {/* Tabs + Search */}
                      <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="flex gap-1 p-1 glass rounded-xl">
                                            <button
                                                            onClick={() => setTab('mine')}
                                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                                              tab === 'mine' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'
                                                            }`}
                                                          >
                                                          Mes Playlists
                                            </button>button>
                                            <button
                                                            onClick={() => setTab('public')}
                                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                                              tab === 'public' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'
                                                            }`}
                                                          >
                                                          Publiques
                                            </button>button>
                                </div>div>
                                <div className="relative flex-1 max-w-sm">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                            type="text"
                                                            value={searchQuery}
                                                            onChange={e => setSearchQuery(e.target.value)}
                                                            placeholder="Rechercher une playlist..."
                                                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-sm text-white focus:outline-none focus:border-red-500"
                                                          />
                                </div>div>
                      </div>div>
              
                {/* Create Modal */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                                <div className="w-full max-w-md mx-4 glass rounded-2xl p-6" onClick={e => e.stopPropagation()}>
                                              <div className="flex items-center justify-between mb-5">
                                                              <h2 className="text-lg font-bold">Nouvelle Playlist</h2>h2>
                                                              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/5 rounded-lg">
                                                                                <X size={20} className="text-gray-400" />
                                                              </button>button>
                                              </div>div>
                                
                                              <div className="space-y-4">
                                                              <div>
                                                                                <label className="block text-sm font-medium text-gray-400 mb-1">Nom *</label>label>
                                                                                <input
                                                                                                      type="text"
                                                                                                      value={newName}
                                                                                                      onChange={e => setNewName(e.target.value)}
                                                                                                      placeholder="Ma playlist..."
                                                                                                      className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500"
                                                                                                      maxLength={100}
                                                                                                    />
                                                              </div>div>
                                                              <div>
                                                                                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>label>
                                                                                <textarea
                                                                                                      value={newDesc}
                                                                                                      onChange={e => setNewDesc(e.target.value)}
                                                                                                      placeholder="Une description optionnelle..."
                                                                                                      rows={3}
                                                                                                      className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 resize-none"
                                                                                                    />
                                                              </div>div>
                                                              <div>
                                                                                <label className="block text-sm font-medium text-gray-400 mb-1">Visibilité</label>label>
                                                                                <div className="flex gap-2">
                                                                                                    <button
                                                                                                                            onClick={() => setNewVisibility('PUBLIC')}
                                                                                                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                                                                                                                                      newVisibility === 'PUBLIC' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#0a0a0f] text-gray-400 border border-[#1e1e2e]'
                                                                                                                              }`}
                                                                                                                          >
                                                                                                                          <Globe size={16} /> Publique
                                                                                                      </button>button>
                                                                                                    <button
                                                                                                                            onClick={() => setNewVisibility('PRIVATE')}
                                                                                                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                                                                                                                                      newVisibility === 'PRIVATE' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-[#0a0a0f] text-gray-400 border border-[#1e1e2e]'
                                                                                                                              }`}
                                                                                                                          >
                                                                                                                          <Lock size={16} /> Privée
                                                                                                      </button>button>
                                                                                </div>div>
                                                              </div>div>
                                              </div>div>
                                
                                              <button
                                                                onClick={handleCreate}
                                                                disabled={creating || !newName.trim()}
                                                                className="w-full mt-5 py-3 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                                                                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                                                              >
                                                {creating ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Créer la playlist'}
                                              </button>button>
                                </div>div>
                    </div>div>
                      )}
              
                {/* Loading */}
                {loading ? (
                    <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin text-red-500" size={40} />
                    </div>div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                                <ListMusic size={64} className="text-gray-700 mx-auto mb-4" />
                                <h2 className="text-xl font-bold text-gray-400 mb-2">
                                  {tab === 'mine' ? 'Aucune playlist' : 'Aucune playlist publique'}
                                </h2>h2>
                                <p className="text-sm text-gray-600 mb-6">
                                  {tab === 'mine' ? 'Crée ta première playlist pour organiser tes beats favoris' : 'Les playlists publiques apparaîtront ici'}
                                </p>p>
                      {tab === 'mine' && session && (
                                    <button
                                                      onClick={() => setShowCreate(true)}
                                                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
                                                      style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                                                    >
                                                    <Plus size={18} /> Créer une playlist
                                    </button>button>
                                )}
                    </div>div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filtered.map(playlist => (
                                    <Link
                                                      key={playlist.id}
                                                      href={`/playlists/${playlist.id}`}
                                                      className="glass rounded-2xl overflow-hidden hover:border-red-500/30 border border-transparent transition-all group"
                                                    >
                                      {/* Cover mosaic */}
                                                    <div className="aspect-[2/1] relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f]">
                                                      {playlist.beats.length > 0 ? (
                                                                          <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                                                            {[0, 1, 2, 3].map(i => (
                                                                                                    <div key={i} className="relative overflow-hidden">
                                                                                                      {playlist.beats[i]?.beat.coverImage ? (
                                                                                                                                  <img
                                                                                                                                                                  src={playlist.beats[i].beat.coverImage!}
                                                                                                                                                                  alt=""
                                                                                                                                                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                                                                                                                />
                                                                                                                                ) : (
                                                                                                                                  <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#2a2a3e] flex items-center justify-center">
                                                                                                                                                                <Music size={20} className="text-gray-700" />
                                                                                                                                    </div>div>
                                                                                                                              )}
                                                                                                      </div>div>
                                                                                                  ))}
                                                                          </div>div>
                                                                        ) : (
                                                                          <div className="w-full h-full flex items-center justify-center">
                                                                                                <ListMusic size={48} className="text-gray-700" />
                                                                          </div>div>
                                                                      )}
                                                      {/* Overlay */}
                                                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                                                      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                                                                                          <span className="text-xs font-semibold text-gray-300">
                                                                                            {playlist._count.beats} beat{playlist._count.beats !== 1 ? 's' : ''}
                                                                                            </span>span>
                                                                                          <span className={`flex items-center gap-1 text-xs ${playlist.visibility === 'PUBLIC' ? 'text-green-400' : 'text-orange-400'}`}>
                                                                                            {playlist.visibility === 'PUBLIC' ? <Globe size={12} /> : <Lock size={12} />}
                                                                                            {playlist.visibility === 'PUBLIC' ? 'Public' : 'Privé'}
                                                                                            </span>span>
                                                                      </div>div>
                                                    </div>div>
                                    
                                      {/* Info */}
                                                    <div className="p-4">
                                                                      <h3 className="font-bold text-white truncate group-hover:text-red-400 transition-colors">{playlist.name}</h3>h3>
                                                      {playlist.description && (
                                                                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{playlist.description}</p>p>
                                                                      )}
                                                                      <div className="flex items-center justify-between mt-3">
                                                                                          <div className="flex items-center gap-2">
                                                                                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-[8px] font-bold text-white">
                                                                                                                  {(playlist.user.displayName || playlist.user.name)?.[0]}
                                                                                                                  </div>div>
                                                                                                                <span className="text-xs text-gray-400">{playlist.user.displayName || playlist.user.name}</span>span>
                                                                                            </div>div>
                                                                        {tab === 'mine' && (
                                                                            <button
                                                                                                      onClick={e => { e.preventDefault(); handleDelete(playlist.id) }}
                                                                                                      className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                                                    >
                                                                                                    <Trash2 size={14} className="text-gray-600 hover:text-red-400" />
                                                                            </button>button>
                                                                                          )}
                                                                      </div>div>
                                                    </div>div>
                                    </Link>Link>
                                  ))}
                    </div>div>
                      )}
              </div>div>
        </div>div>
      )
}</div>
