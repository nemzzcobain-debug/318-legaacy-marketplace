'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { ListMusic, Plus, Check, Loader2, X } from 'lucide-react'

interface Playlist {
  id: string
  name: string
  _count: { beats: number }
}

interface Props {
  beatId: string
  size?: 'sm' | 'md'
}

export default function AddToPlaylistButton({ beatId, size = 'sm' }: Props) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && session) fetchPlaylists()
  }, [open, session])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!session) return null

  async function fetchPlaylists() {
    setLoading(true)
    try {
      const res = await fetch('/api/playlists?mode=mine')
      if (res.ok) setPlaylists(await res.json())
    } catch {} finally { setLoading(false) }
  }

  async function addToPlaylist(playlistId: string) {
    setAdding(playlistId)
    try {
      const res = await fetch(`/api/playlists/${playlistId}/beats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatId }),
      })
      if (res.ok || res.status === 409) {
        setAdded(prev => new Set(prev).add(playlistId))
      }
    } catch {} finally { setAdding(null) }
  }

  async function createAndAdd() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), visibility: 'PUBLIC' }),
      })
      if (res.ok) {
        const playlist = await res.json()
        await addToPlaylist(playlist.id)
        setNewName('')
        fetchPlaylists()
      }
    } catch {} finally { setCreating(false) }
  }

  const iconSize = size === 'sm' ? 14 : 18

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg transition-colors ${
          size === 'sm'
            ? 'p-1.5 hover:bg-white/10'
            : 'px-3 py-1.5 hover:bg-white/10 text-xs font-semibold text-gray-400'
        }`}
        aria-label="Ajouter à une playlist"
      >
        <ListMusic size={iconSize} className="text-gray-400" />
        {size === 'md' && 'Playlist'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 glass rounded-xl border border-[#1e1e2e] shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-[#1e1e2e] flex items-center justify-between">
            <span className="text-sm font-bold text-white">Ajouter à une playlist</span>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-white/5 rounded" aria-label="Fermer">
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          {/* Create new */}
          <div className="p-2 border-b border-[#1e1e2e]">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nouvelle playlist..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-xs text-white focus:outline-none focus:border-red-500"
                onKeyDown={e => e.key === 'Enter' && createAndAdd()}
              />
              <button
                onClick={createAndAdd}
                disabled={creating || !newName.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
            </div>
          </div>

          {/* Playlist list */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="py-6 flex justify-center"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
            ) : playlists.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">Aucune playlist</p>
            ) : (
              playlists.map(p => (
                <button
                  key={p.id}
                  onClick={() => !added.has(p.id) && addToPlaylist(p.id)}
                  disabled={adding === p.id || added.has(p.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p._count.beats} beats</p>
                  </div>
                  {adding === p.id ? (
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  ) : added.has(p.id) ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Plus size={14} className="text-gray-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
