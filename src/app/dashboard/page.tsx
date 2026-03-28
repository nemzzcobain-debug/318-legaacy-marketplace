'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import {
  BarChart3, DollarSign, Gavel, Music, TrendingUp, Plus, Clock,
  Package, Users, Settings, Bell, ChevronRight, ArrowUpRight
} from 'lucide-react'

// Dashboard tabs
type Tab = 'overview' | 'beats' | 'auctions' | 'earnings' | 'settings'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
    { id: 'beats', label: 'Mes Beats', icon: Music },
    { id: 'auctions', label: 'Mes Encheres', icon: Gavel },
    { id: 'earnings', label: 'Revenus', icon: DollarSign },
    { id: 'settings', label: 'Parametres', icon: Settings },
  ]

  // Mock stats
  const stats = [
    { label: 'Revenus total', value: '2,450\u20AC', change: '+18%', icon: DollarSign, color: '#e11d48' },
    { label: 'Beats en vente', value: '12', change: '+3', icon: Music, color: '#667eea' },
    { label: 'Encheres actives', value: '5', change: '+2', icon: Gavel, color: '#ff0033' },
    { label: 'Total encheres', value: '87', change: '+24', icon: TrendingUp, color: '#2ed573' },
  ]

  const recentAuctions = [
    { title: 'Midnight Vendetta', bid: 85, bids: 12, timeLeft: '2h 30m', status: 'active' },
    { title: 'Cloud Walker', bid: 55, bids: 9, timeLeft: '12h', status: 'active' },
    { title: 'Dark Energy', bid: 200, bids: 24, timeLeft: 'Termine', status: 'ended' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Bienvenue, LEGAACY</p>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            <Plus size={16} /> Nouveau Beat
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${activeTab === id
                  ? 'bg-[#e11d4815] text-[#e11d48] border border-[#e11d4830]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map(({ label, value, change, icon: Icon, color }) => (
                <div
                  key={label}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}15` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <span className="text-xs font-semibold text-[#2ed573] flex items-center gap-0.5">
                      <ArrowUpRight size={12} /> {change}
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-white">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Recent Auctions */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Encheres recentes</h2>
                <button className="text-xs text-[#e11d48] font-semibold flex items-center gap-1 hover:underline">
                  Voir tout <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {recentAuctions.map((auction) => (
                  <div
                    key={auction.title}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
                        <Music size={16} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{auction.title}</div>
                        <div className="text-xs text-gray-500">{auction.bids} encheres</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-[#e11d48]">{auction.bid}&euro;</div>
                      <div className={`text-xs flex items-center gap-1 ${
                        auction.status === 'active' ? 'text-[#2ed573]' : 'text-gray-500'
                      }`}>
                        <Clock size={10} /> {auction.timeLeft}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Beats Tab */}
        {activeTab === 'beats' && (
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
            <div className="text-center py-12">
              <Music size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-bold text-white mb-2">Tes beats apparaitront ici</h3>
              <p className="text-sm text-gray-400 mb-5">
                Upload ton premier beat pour commencer a le vendre aux encheres
              </p>
              <button
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <Plus size={16} /> Ajouter un beat
              </button>
            </div>
          </div>
        )}

        {/* Auctions Tab */}
        {activeTab === 'auctions' && (
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
            <div className="text-center py-12">
              <Gavel size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-bold text-white mb-2">Tes encheres apparaitront ici</h3>
              <p className="text-sm text-gray-400">
                Cree une enchere sur un de tes beats pour commencer
              </p>
            </div>
          </div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Revenus</h2>
              <span className="text-xs text-gray-500">Commission plateforme: 15%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#1e1e2e]">
                <div className="text-xs text-gray-500 mb-1">Disponible</div>
                <div className="text-2xl font-extrabold text-[#2ed573]">1,820&euro;</div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#1e1e2e]">
                <div className="text-xs text-gray-500 mb-1">En attente</div>
                <div className="text-2xl font-extrabold text-[#e11d48]">630&euro;</div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#1e1e2e]">
                <div className="text-xs text-gray-500 mb-1">Total verse</div>
                <div className="text-2xl font-extrabold text-white">4,250&euro;</div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Les paiements sont traites via Stripe Connect. Tu recois 85% du montant final de chaque vente.
              Les virements sont effectues automatiquement chaque semaine.
            </p>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Parametres du compte</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Nom d&apos;affichage</label>
                <input
                  type="text"
                  defaultValue="LEGAACY"
                  className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-sm outline-none focus:border-[#e11d4850]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Bio</label>
                <textarea
                  rows={3}
                  defaultValue="Fondateur 318 LEGAACY Studio"
                  className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-sm outline-none focus:border-[#e11d4850] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Compte Stripe</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#2ed573] font-semibold">Connecte</span>
                  <span className="text-xs text-gray-500">acct_1S5qJJ...WEQ</span>
                </div>
              </div>

              <button
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                Sauvegarder
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
