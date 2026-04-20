'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  Camera,
  Save,
  Globe,
  Instagram,
  Twitter,
  Youtube,
  Music,
  Headphones,
  Bell,
  Mail,
  MessageCircle,
  Gavel,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Link as LinkIcon,
  Shield,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react'

interface ProfileData {
  id: string
  email: string
  name: string
  displayName: string | null
  avatar: string | null
  bio: string | null
  role: string
  website: string | null
  instagram: string | null
  twitter: string | null
  youtube: string | null
  soundcloud: string | null
  spotify: string | null
  notifEmail: boolean
  notifBid: boolean
  notifMessage: boolean
  producerStatus: string | null
  producerBio: string | null
  portfolio: string | null
  totalSales: number
  totalPurchases: number
  rating: number
  createdAt: string
  _count: {
    followers: number
    following: number
    beats: number
    bids: number
  }
}

interface ProfileFormData {
  name: string
  displayName: string
  bio: string
  website: string
  instagram: string
  twitter: string
  youtube: string
  soundcloud: string
  spotify: string
  notifEmail: boolean
  notifBid: boolean
  notifMessage: boolean
  producerBio: string
  portfolio: string
}

export default function ProfileEditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<
    'general' | 'social' | 'producer' | 'notifications' | 'security'
  >('general')

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwError, setPwError] = useState('')
  const [isOAuthUser, setIsOAuthUser] = useState(false)

  // Form state
  const [form, setForm] = useState<ProfileFormData>({
    name: '',
    displayName: '',
    bio: '',
    website: '',
    instagram: '',
    twitter: '',
    youtube: '',
    soundcloud: '',
    spotify: '',
    notifEmail: true,
    notifBid: true,
    notifMessage: true,
    producerBio: '',
    portfolio: '',
  })

  const user = session?.user
  const isProducer = user?.role === 'PRODUCER' || user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      setProfile(data)
      setIsOAuthUser(!data.hasPassword)
      setForm({
        name: data.name || '',
        displayName: data.displayName || '',
        bio: data.bio || '',
        website: data.website || '',
        instagram: data.instagram || '',
        twitter: data.twitter || '',
        youtube: data.youtube || '',
        soundcloud: data.soundcloud || '',
        spotify: data.spotify || '',
        notifEmail: data.notifEmail ?? true,
        notifBid: data.notifBid ?? true,
        notifMessage: data.notifMessage ?? true,
        producerBio: data.producerBio || '',
        portfolio: data.portfolio || '',
      })
    } catch {
      setError('Impossible de charger le profil')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      const updated = await res.json()
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPwError('')
    setPwSuccess('')

    if (!newPassword || newPassword.length < 8) {
      setPwError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPwError('Le mot de passe doit contenir au moins une majuscule')
      return
    }
    if (!/[a-z]/.test(newPassword)) {
      setPwError('Le mot de passe doit contenir au moins une minuscule')
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setPwError('Le mot de passe doit contenir au moins un chiffre')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Les mots de passe ne correspondent pas')
      return
    }
    if (!isOAuthUser && !currentPassword) {
      setPwError('Le mot de passe actuel est requis')
      return
    }

    setPwLoading(true)
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: isOAuthUser ? undefined : currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du changement de mot de passe')
      }
      setPwSuccess('Mot de passe mis à jour avec succès !')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsOAuthUser(false) // Now they have a password
      setTimeout(() => setPwSuccess(''), 4000)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur upload')
      }

      const { url } = await res.json()
      setProfile((prev) => (prev ? { ...prev, avatar: url } : prev))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={40} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Profil non trouvé</p>
      </div>
    )
  }

  const tabs = [
    { id: 'general' as const, label: 'Général', icon: User },
    { id: 'social' as const, label: 'Réseaux sociaux', icon: LinkIcon },
    ...(isProducer ? [{ id: 'producer' as const, label: 'Producteur', icon: Headphones }] : []),
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Sécurité', icon: Shield },
  ]

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="relative group/back p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
            <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-[#1a1a2e] px-3 py-1.5 text-xs font-medium text-white opacity-0 scale-95 transition-all duration-200 group-hover/back:opacity-100 group-hover/back:scale-100 border border-white/10 shadow-xl">
              Retour
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a2e] border-t border-l border-white/10 rotate-45" />
            </span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Mon Profil</h1>
            <p className="text-sm text-gray-500">Gérez vos informations personnelles</p>
          </div>
        </div>

        {/* Avatar Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                {profile.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {profile.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="animate-spin text-white" size={24} />
                ) : (
                  <Camera size={24} className="text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.displayName || profile.name}</h2>
              <p className="text-sm text-gray-400">{profile.email}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>{profile._count.followers} abonnés</span>
                <span>{profile._count.following} abonnements</span>
                {isProducer && <span>{profile._count.beats} beats</span>}
                <span>
                  Membre depuis{' '}
                  {new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-4">
            <Check size={16} /> Profil mis à jour avec succès
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 glass rounded-xl overflow-visible">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative group/tab flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-[#1a1a2e] px-3 py-1.5 text-xs font-medium text-white opacity-0 scale-95 transition-all duration-200 group-hover/tab:opacity-100 group-hover/tab:scale-100 border border-white/10 shadow-xl">
                {tab.label}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a2e] border-b border-r border-white/10 rotate-45" />
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass rounded-2xl p-6">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold mb-4">Informations générales</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Nom *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Nom d&apos;affichage
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Nom affiché publiquement"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Bio <span className="text-gray-600">({form.bio.length}/500)</span>
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 500) }))}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors resize-none"
                  placeholder="Parlez de vous en quelques mots..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f]/50 border border-[#1e1e2e] text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">L&apos;email ne peut pas être modifié</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-red-400">{profile.totalSales}</p>
                  <p className="text-xs text-gray-500">Ventes</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-blue-400">{profile.totalPurchases}</p>
                  <p className="text-xs text-gray-500">Achats</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-yellow-400">{profile._count.bids}</p>
                  <p className="text-xs text-gray-500">Enchères</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-green-400">
                    {profile.rating > 0 ? profile.rating.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-gray-500">Note</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold mb-4">Réseaux sociaux</h3>

              {[
                {
                  key: 'website',
                  label: 'Site web',
                  icon: Globe,
                  placeholder: 'https://votre-site.com',
                },
                {
                  key: 'instagram',
                  label: 'Instagram',
                  icon: Instagram,
                  placeholder: 'https://instagram.com/votre-profil',
                },
                {
                  key: 'twitter',
                  label: 'X / Twitter',
                  icon: Twitter,
                  placeholder: 'https://x.com/votre-profil',
                },
                {
                  key: 'youtube',
                  label: 'YouTube',
                  icon: Youtube,
                  placeholder: 'https://youtube.com/@votre-chaine',
                },
                {
                  key: 'soundcloud',
                  label: 'SoundCloud',
                  icon: Music,
                  placeholder: 'https://soundcloud.com/votre-profil',
                },
                {
                  key: 'spotify',
                  label: 'Spotify',
                  icon: Headphones,
                  placeholder: 'https://open.spotify.com/artist/...',
                },
              ].map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-1.5">
                    <Icon size={16} /> {label}
                  </label>
                  <input
                    type="url"
                    value={(form[key as keyof ProfileFormData] as string) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'producer' && isProducer && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold mb-4">Profil Producteur</h3>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <Check size={16} />
                Statut:{' '}
                {profile.producerStatus === 'APPROVED'
                  ? 'Approuvé'
                  : profile.producerStatus || 'En attente'}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Bio Producteur{' '}
                  <span className="text-gray-600">({form.producerBio.length}/1000)</span>
                </label>
                <textarea
                  value={form.producerBio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, producerBio: e.target.value.slice(0, 1000) }))
                  }
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors resize-none"
                  placeholder="Décrivez votre style, votre expérience, vos influences..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-1.5">
                  <Globe size={16} /> Portfolio / Site
                </label>
                <input
                  type="url"
                  value={form.portfolio}
                  onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="https://votre-portfolio.com"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1e1e2e]">
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-red-400">{profile._count.beats}</p>
                  <p className="text-xs text-gray-500">Beats uploadés</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-green-400">{profile.totalSales}</p>
                  <p className="text-xs text-gray-500">Ventes</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#0a0a0f]">
                  <p className="text-2xl font-bold text-yellow-400">
                    {profile.rating > 0 ? profile.rating.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-gray-500">Note moyenne</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold mb-4">Préférences de notification</h3>

              {[
                {
                  key: 'notifEmail',
                  label: 'Notifications par email',
                  desc: 'Recevoir des emails pour les enchères gagnées, paiements reçus',
                  icon: Mail,
                },
                {
                  key: 'notifBid',
                  label: 'Alertes enchères',
                  desc: "Être notifié quand quelqu'un surenchérit ou quand une enchère se termine",
                  icon: Gavel,
                },
                {
                  key: 'notifMessage',
                  label: 'Notifications messages',
                  desc: 'Recevoir des notifications pour les nouveaux messages privés',
                  icon: MessageCircle,
                },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Icon size={20} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        [key]: !(f[key as keyof ProfileFormData] as boolean),
                      }))
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      form[key as keyof ProfileFormData] ? 'bg-red-500' : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        form[key as keyof ProfileFormData] ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold mb-4">Sécurité du compte</h3>

              {/* Account info */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e]">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <KeyRound size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {isOAuthUser ? 'Compte Google' : 'Compte email / mot de passe'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isOAuthUser
                      ? 'Tu es connecté via Google. Tu peux définir un mot de passe pour aussi pouvoir te connecter par email.'
                      : 'Tu peux modifier ton mot de passe ci-dessous.'}
                  </p>
                </div>
              </div>

              {/* Password change form */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-300">
                  {isOAuthUser ? 'Définir un mot de passe' : 'Changer le mot de passe'}
                </h4>

                {pwSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    <Check size={16} /> {pwSuccess}
                  </div>
                )}
                {pwError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle size={16} /> {pwError}
                  </div>
                )}

                {/* Current password - only if not OAuth user */}
                {!isOAuthUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                      Mot de passe actuel
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors pr-12"
                        placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors pr-12"
                      placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* Password strength indicators */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      {[
                        { test: newPassword.length >= 8, label: 'Au moins 8 caractères' },
                        { test: /[A-Z]/.test(newPassword), label: 'Une majuscule' },
                        { test: /[a-z]/.test(newPassword), label: 'Une minuscule' },
                        { test: /[0-9]/.test(newPassword), label: 'Un chiffre' },
                      ].map(({ test, label }) => (
                        <div
                          key={label}
                          className={`flex items-center gap-2 text-xs ${test ? 'text-green-400' : 'text-gray-600'}`}
                        >
                          {test ? (
                            <Check size={12} />
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-gray-600" />
                          )}
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-white focus:outline-none focus:border-red-500 transition-colors pr-12"
                      placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  onClick={handleChangePassword}
                  disabled={
                    pwLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword
                  }
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  {pwLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Shield size={18} />
                  )}
                  {pwLoading
                    ? 'Modification...'
                    : isOAuthUser
                      ? 'Définir le mot de passe'
                      : 'Modifier le mot de passe'}
                </button>
              </div>

              {/* Account info section */}
              <div className="pt-5 border-t border-[#1e1e2e]">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Informations du compte</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e]">
                    <span className="text-sm text-gray-400">Email</span>
                    <span className="text-sm text-white font-medium">{profile.email}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e]">
                    <span className="text-sm text-gray-400">Rôle</span>
                    <span
                      className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                        profile.role === 'ADMIN'
                          ? 'bg-orange-500/20 text-orange-400'
                          : profile.role === 'PRODUCER'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {profile.role === 'ADMIN'
                        ? 'Admin'
                        : profile.role === 'PRODUCER'
                          ? 'Producteur'
                          : 'Artiste'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e]">
                    <span className="text-sm text-gray-400">Membre depuis</span>
                    <span className="text-sm text-white font-medium">
                      {new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
