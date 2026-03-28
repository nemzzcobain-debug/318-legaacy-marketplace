'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Shield, Star, BarChart3, Award, Zap, Music, Search } from 'lucide-react'

interface Producer {
  id: string
  name: string
  displayName?: string
  avatar?: string
  producerBio?: string
  rating: number
  totalSales: number
  _count?: { beats: number }
}

export default function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetch('/api/producers')
        const data = await res.json()
        setProducers(data.producers || [])
      } catch (err) {
        console.error('Erreur chargement producteurs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProducers()
  }, [])

  const filtered = producers.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.displayName?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Producteurs verifies</h1>
          <p className="text-gray-400">
            Marketplace ouverte sous validation — seuls les producteurs approuves peuvent vendre
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md relative mb-8">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un producteur..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850]"
          />
        </div>

        {/* Producers Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#13131a] border border-[#1e1e2e] rounded-xl h-56 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((producer) => (
              <Link
                href={`/producer/${producer.id}`}
                key={producer.id}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 text-center hover:border-[#e11d4830] transition-colors cursor-pointer block"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-2xl font-extrabold text-white mx-auto mb-3 border-2 border-[#e11d48]">
                  {producer.avatar || producer.name[0]}
                </div>

                <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                  {producer.displayName || producer.name}
                  <Shield size={14} className="text-[#e11d48]" />
                </h3>

                {producer.totalSales > 200 ? (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e11d4815] text-[#e11d48]">
                    Top Seller
                  </span>
                ) : producer.totalSales > 50 ? (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#667eea15] text-[#667eea]">
                    Certifie
                  </span>
                ) : (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2ed57315] text-[#2ed573]">
                    Nouveau
                  </span>
                )}

                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                  {producer.producerBio || producer.name}
                </p>

                <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star size={11} /> {producer.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 size={11} /> {producer.totalSales} ventes
                  </span>
                  <span className="flex items-center gap-1">
                    <Music size={11} /> {producer._count?.beats || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA Devenir producteur */}
        <div className="mt-12 p-8 rounded-2xl bg-[#e11d4808] border border-[#e11d4820] text-center">
          <Award size={40} className="text-[#e11d48] mx-auto mb-3" />
          <h3 className="text-xl font-extrabold text-white mb-2">
            Deviens producteur sur 318 LEGAACY
          </h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
            Soumets ta candidature pour vendre tes beats aux encheres.
            Notre equipe verifie chaque profil pour garantir la qualite.
          </p>
          <a
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            <Zap size={18} /> Postuler maintenant
          </a>
        </div>
      </main>
    </div>
  )
}
