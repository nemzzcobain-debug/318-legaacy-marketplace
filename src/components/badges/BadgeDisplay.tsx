'use client'

import { useState, useEffect } from 'react'
import { Award, ChevronRight, Lock, Sparkles, TrendingUp } from 'lucide-react'

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  category: 'sales' | 'beats' | 'community' | 'quality' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface Level {
  level: number
  name: string
  minXP: number
  color: string
  xp: number
  nextLevelXP: number | null
  progress: number
}

interface BadgeData {
  badges: Badge[]
  totalBadges: number
  maxBadges: number
  level: Level
  nextBadges: Badge[]
  stats: any
}

const RARITY_STYLES: Record<string, { bg: string; border: string; glow: string }> = {
  common: { bg: 'bg-[#6b728015]', border: 'border-[#6b728030]', glow: '' },
  rare: { bg: 'bg-[#3b82f610]', border: 'border-[#3b82f625]', glow: '' },
  epic: { bg: 'bg-[#a855f710]', border: 'border-[#a855f725]', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.1)]' },
  legendary: { bg: 'bg-[#ffd70010]', border: 'border-[#ffd70025]', glow: 'shadow-[0_0_20px_rgba(255,215,0,0.15)]' },
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Epique',
  legendary: 'Legendaire',
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Ventes',
  beats: 'Beats',
  community: 'Communaute',
  quality: 'Qualite',
  special: 'Special',
}

// ─── COMPACT BADGE GRID (for profile page) ───
export function BadgeGrid({ userId }: { userId: string }) {
  const [data, setData] = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch(`/api/badges?userId=${userId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchBadges()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data || data.badges.length === 0) {
    return (
      <div className="text-center py-8">
        <Award size={36} className="mx-auto mb-3 text-gray-600" />
        <p className="text-gray-400 text-sm font-bold">Aucun badge pour le moment</p>
        <p className="text-gray-600 text-xs mt-1">Les badges sont debloques automatiquement</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Level bar */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[#13131a] border border-[#1e1e2e]">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black shrink-0"
          style={{ background: `${data.level.color}15`, color: data.level.color }}
        >
          {data.level.level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-white">{data.level.name}</span>
            <span className="text-xs text-gray-500">{data.level.xp} XP</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${data.level.progress}%`,
                background: `linear-gradient(90deg, ${data.level.color}, ${data.level.color}aa)`,
              }}
            />
          </div>
          {data.level.nextLevelXP && (
            <div className="text-[10px] text-gray-600 mt-1">
              {data.level.nextLevelXP - data.level.xp} XP pour le prochain niveau
            </div>
          )}
        </div>
      </div>

      {/* Badge count */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles size={14} className="text-yellow-400" />
          {data.totalBadges} / {data.maxBadges} badges
        </span>
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {data.badges.map((badge) => {
          const style = RARITY_STYLES[badge.rarity]
          return (
            <div
              key={badge.id}
              className={`group relative flex flex-col items-center p-3 rounded-xl border ${style.bg} ${style.border} ${style.glow} hover:scale-105 transition-transform cursor-default`}
            >
              <span className="text-2xl mb-1.5">{badge.icon}</span>
              <span className="text-[10px] font-bold text-white text-center leading-tight">{badge.name}</span>
              <span
                className="text-[8px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded-full"
                style={{ color: badge.color, background: `${badge.color}15` }}
              >
                {RARITY_LABELS[badge.rarity]}
              </span>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                <div className="text-xs font-bold text-white mb-0.5">{badge.name}</div>
                <div className="text-[10px] text-gray-400 leading-relaxed">{badge.description}</div>
                <div className="text-[9px] text-gray-600 mt-1">{CATEGORY_LABELS[badge.category]}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next badges to unlock */}
      {data.nextBadges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock size={12} className="text-gray-500" />
            <span className="text-xs font-bold text-gray-500">Prochains badges</span>
          </div>
          <div className="space-y-2">
            {data.nextBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-[#1e1e2e] opacity-50"
              >
                <span className="text-lg grayscale">{badge.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-400">{badge.name}</div>
                  <div className="text-[10px] text-gray-600 truncate">{badge.description}</div>
                </div>
                <span
                  className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/5 text-gray-600"
                >
                  {RARITY_LABELS[badge.rarity]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── INLINE BADGE ROW (for profile header) ───
export function BadgeRow({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<Badge[]>([])
  const [level, setLevel] = useState<Level | null>(null)

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch(`/api/badges?userId=${userId}`)
        if (res.ok) {
          const json = await res.json()
          setBadges(json.badges.slice(0, 5)) // Show top 5
          setLevel(json.level)
        }
      } catch {
        // silent
      }
    }
    fetchBadges()
  }, [userId])

  if (badges.length === 0 && !level) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {level && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ color: level.color, background: `${level.color}15`, border: `1px solid ${level.color}25` }}
        >
          <TrendingUp size={10} /> Nv.{level.level} {level.name}
        </span>
      )}
      {badges.map((badge) => (
        <span
          key={badge.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-default"
          style={{ color: badge.color, background: `${badge.color}15`, border: `1px solid ${badge.color}25` }}
          title={badge.description}
        >
          {badge.icon} {badge.name}
        </span>
      ))}
    </div>
  )
}

// ─── DASHBOARD BADGES TAB ───
export function BadgesFullView({ userId }: { userId: string }) {
  const [data, setData] = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch(`/api/badges?userId=${userId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchBadges()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const categories = ['all', 'sales', 'beats', 'community', 'quality', 'special']
  const filtered = selectedCategory === 'all'
    ? data.badges
    : data.badges.filter((b) => b.category === selectedCategory)

  const categoryLabels: Record<string, string> = {
    all: 'Tous',
    ...CATEGORY_LABELS,
  }

  return (
    <div className="space-y-6">
      {/* Level Card */}
      <div className="relative overflow-hidden rounded-xl border border-[#1e1e2e] p-6"
        style={{ background: `linear-gradient(135deg, ${data.level.color}08, ${data.level.color}03)` }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: data.level.color }} />
        <div className="relative flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black shrink-0"
            style={{ background: `${data.level.color}15`, color: data.level.color, border: `2px solid ${data.level.color}30` }}
          >
            {data.level.level}
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Niveau</div>
            <div className="text-xl font-extrabold text-white mb-2">{data.level.name}</div>
            <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${data.level.progress}%`,
                  background: `linear-gradient(90deg, ${data.level.color}, ${data.level.color}aa)`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-bold">{data.level.xp} XP</span>
              {data.level.nextLevelXP && (
                <span className="text-gray-600">{data.level.nextLevelXP} XP requis</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[#13131a] border border-[#1e1e2e] text-center">
          <div className="text-xl font-extrabold text-white">{data.totalBadges}</div>
          <div className="text-[10px] text-gray-500">Badges gagnes</div>
        </div>
        <div className="p-3 rounded-xl bg-[#13131a] border border-[#1e1e2e] text-center">
          <div className="text-xl font-extrabold text-gray-400">{data.maxBadges - data.totalBadges}</div>
          <div className="text-[10px] text-gray-500">A debloquer</div>
        </div>
        <div className="p-3 rounded-xl bg-[#13131a] border border-[#1e1e2e] text-center">
          <div className="text-xl font-extrabold" style={{ color: data.level.color }}>{data.level.level}</div>
          <div className="text-[10px] text-gray-500">Niveau</div>
        </div>
        <div className="p-3 rounded-xl bg-[#13131a] border border-[#1e1e2e] text-center">
          <div className="text-xl font-extrabold text-yellow-400">{data.level.xp}</div>
          <div className="text-[10px] text-gray-500">XP Total</div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-[#e11d4815] text-[#e11d48] border border-[#e11d4830]'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Earned badges */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-yellow-400" />
          Badges debloques ({filtered.length})
        </h3>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Aucun badge dans cette categorie
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((badge) => {
              const style = RARITY_STYLES[badge.rarity]
              return (
                <div
                  key={badge.id}
                  className={`flex flex-col items-center p-4 rounded-xl border ${style.bg} ${style.border} ${style.glow} hover:scale-[1.03] transition-transform`}
                >
                  <span className="text-3xl mb-2">{badge.icon}</span>
                  <span className="text-xs font-bold text-white text-center">{badge.name}</span>
                  <span className="text-[10px] text-gray-400 text-center mt-1 leading-tight">{badge.description}</span>
                  <span
                    className="text-[8px] font-bold uppercase mt-2 px-2 py-0.5 rounded-full"
                    style={{ color: badge.color, background: `${badge.color}15` }}
                  >
                    {RARITY_LABELS[badge.rarity]}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Next badges */}
      {data.nextBadges.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
            <Lock size={14} />
            Prochains objectifs
          </h3>
          <div className="space-y-2">
            {data.nextBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-[#1e1e2e]"
              >
                <span className="text-2xl grayscale opacity-40">{badge.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-300">{badge.name}</div>
                  <div className="text-xs text-gray-600">{badge.description}</div>
                </div>
                <span
                  className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/5 text-gray-600 shrink-0"
                >
                  {RARITY_LABELS[badge.rarity]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
