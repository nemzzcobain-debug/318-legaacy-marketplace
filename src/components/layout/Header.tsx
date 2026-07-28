'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  ArrowLeft,
  Gavel,
  Users,
  LogIn,
  UserPlus,
  LayoutDashboard,
  Upload,
  Shield,
  LogOut,
  MessageCircle,
  ShoppingBag,
  Eye,
  ListMusic,
  Menu,
  X,
  User,
} from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LanguageSelector from '@/components/ui/LanguageSelector'
import { useTranslation } from '@/i18n/LanguageContext'

// Tooltip component for header icon links
function HeaderTooltip({
  name,
  description,
  indicator,
}: {
  name: string
  description: string
  indicator?: string
}) {
  return (
    <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] w-52 rounded-xl bg-[#1a1a2e]/95 backdrop-blur-xl px-4 py-3 opacity-0 scale-95 transition-all duration-200 group-hover/tip:opacity-100 group-hover/tip:scale-100 border border-white/10 shadow-2xl">
      <span className="block text-sm font-bold text-white mb-0.5">{name}</span>
      <span className="block text-[11px] text-gray-400 leading-relaxed">{description}</span>
      {indicator && (
        <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-semibold">
          {indicator}
        </span>
      )}
      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a2e] border-t border-l border-white/10 rotate-45" />
    </span>
  )
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { t } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const user = session?.user as any
  const isProducer = user?.role === 'PRODUCER' || user?.role === 'ADMIN'

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const goBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push('/')
  }

  const navItems = [{ href: '/producers', label: t('nav.producers'), icon: Users }]

  // Tooltip data for icon-only header links
  const iconTooltips: Record<string, { name: string; description: string; indicator?: string }> = {
    playlists: {
      name: 'Mes Playlists',
      description: 'Retrouvez et gérez vos playlists de beats favoris',
    },
    watchlist: {
      name: 'Watchlist',
      description: 'Les beats que vous surveillez et suivez en temps réel',
    },
    purchases: { name: 'Mes Achats', description: 'Vos beats achetés et licences obtenues' },
    auctions: { name: 'Mes Enchères', description: 'Vos enchères en cours et passées' },
    messages: { name: 'Messages', description: 'Conversations avec les producteurs et acheteurs' },
    dashboard: { name: 'Dashboard', description: 'Gérez votre activité, stats et paramètres' },
    admin: { name: 'Administration', description: "Panneau d'administration du site" },
  }

  return (
    <header className="sticky top-0 z-50 glass overflow-visible">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-2 md:px-6">
        <div className="flex min-w-0 items-center gap-1">
          {pathname !== '/' && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 text-gray-200 shadow-sm shadow-red-950/20 transition hover:border-red-500/60 hover:bg-red-500/15 hover:text-white md:w-auto md:px-3"
              aria-label="Revenir à la page précédente"
            >
              <ArrowLeft size={20} />
              <span className="hidden text-sm font-bold md:inline">Retour</span>
            </button>
          )}

          {/* Logo */}
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Accueil 318 LEGAACY">
            <Image
              src="/logo-318-marketplace.png"
              alt=""
              width={56}
              height={56}
              className="h-11 w-11 shrink-0 rounded-lg md:h-14 md:w-14"
              style={{
                maskImage: 'radial-gradient(circle, white 40%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(circle, white 40%, transparent 75%)',
              }}
            />
            <div className="hidden sm:block">
              <span className="font-extrabold text-sm tracking-tight">318 LEGAACY</span>
              <span className="block text-[10px] text-red-500 -mt-0.5 tracking-[3px] font-semibold">
                MARKETPLACE
              </span>
            </div>
          </Link>
        </div>

        {/* Nav Desktop */}
        <nav
          className="hidden items-center gap-4 md:flex"
          role="navigation"
          aria-label="Navigation principale"
        >
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-0.5 border-b-2 transition-colors ${
                pathname === href
                  ? 'text-red-500 border-red-500'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth / User */}
        <div className="hidden items-center gap-1 md:flex">
          {session ? (
            <>
              {/* Upload Button for Producers/Admin */}
              {isProducer && (
                <Link
                  href="/producers/upload"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <Upload size={14} /> {t('nav.upload')}
                </Link>
              )}

              {/* Admin link */}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                  aria-label={t('nav.admin')}
                >
                  <Shield size={20} className="text-orange-400" />
                  <HeaderTooltip {...iconTooltips.admin} />
                </Link>
              )}

              <Link
                href="/playlists"
                className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label={t('nav.myPlaylists')}
              >
                <ListMusic size={20} className="text-gray-400" />
                <HeaderTooltip {...iconTooltips.playlists} />
              </Link>
              <Link
                href="/watchlist"
                className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label={t('nav.myWatchlist')}
              >
                <Eye size={20} className="text-gray-400" />
                <HeaderTooltip {...iconTooltips.watchlist} />
              </Link>
              <Link
                href="/purchases"
                className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label={t('nav.myPurchases')}
              >
                <ShoppingBag size={20} className="text-gray-400" />
                <HeaderTooltip {...iconTooltips.purchases} />
              </Link>
              <Link
                href="/my-auctions"
                className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label={t('nav.myAuctions')}
              >
                <Gavel size={20} className="text-gray-400" />
                <HeaderTooltip {...iconTooltips.auctions} />
              </Link>
              <Link
                href="/messages"
                className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label={t('nav.messages')}
              >
                <MessageCircle size={20} className="text-gray-400" />
                <HeaderTooltip {...iconTooltips.messages} />
              </Link>
              <Link
                href="/dashboard"
                className="relative group/tip p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label={t('nav.dashboard')}
              >
                <LayoutDashboard size={20} className="text-gray-400" />
                <HeaderTooltip {...iconTooltips.dashboard} />
              </Link>
              <NotificationBell />
              <LanguageSelector />
              <ThemeToggle />

              {/* User avatar + logout */}
              <div className="flex items-center gap-2">
                <Link
                  href="/profile/edit"
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-xs font-bold text-white hover:ring-2 hover:ring-red-500 transition-all"
                  aria-label={t('nav.profile')}
                >
                  {user?.name?.[0] || 'U'}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 text-sm font-bold text-red-300 transition hover:border-red-400 hover:bg-red-500/20 hover:text-white"
                  aria-label={t('nav.logout')}
                >
                  <LogOut size={18} />
                  <span className="hidden xl:inline">Déconnexion</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <LanguageSelector />
              <ThemeToggle />
              <Link
                href="/login"
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1e1e2e] text-sm font-semibold text-white hover:border-red-500 transition-colors"
              >
                <LogIn size={14} /> {t('nav.login')}
              </Link>
              <Link
                href="/register"
                aria-label={t('nav.register')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <UserPlus size={14} /> <span className="hidden sm:inline">{t('nav.register')}</span>
              </Link>
            </>
          )}
        </div>

        {/* Navigation mobile : commandes essentielles visibles, le reste dans un menu. */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          {session && <NotificationBell />}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-300 transition hover:bg-white/5 hover:text-white"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          className="absolute inset-x-3 top-[calc(100%+0.5rem)] z-[100] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#111111] p-3 shadow-2xl md:hidden"
          aria-label="Navigation mobile"
        >
          <div className="grid grid-cols-2 gap-2">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  pathname === href
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-white/[0.03] text-gray-300 hover:bg-white/[0.07] hover:text-white'
                }`}
                aria-current={pathname === href ? 'page' : undefined}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}

            {session ? (
              <>
                {isProducer && (
                  <Link
                    href="/producers/upload"
                    className="flex min-h-12 items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300"
                  >
                    <Upload size={18} />
                    {t('nav.upload')}
                  </Link>
                )}
                {user?.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="flex min-h-12 items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm font-semibold text-gray-300"
                  >
                    <Shield size={18} className="text-orange-400" />
                    Administration
                  </Link>
                )}
                {[
                  { href: '/playlists', label: 'Playlists', icon: ListMusic },
                  { href: '/watchlist', label: 'Watchlist', icon: Eye },
                  { href: '/purchases', label: 'Mes achats', icon: ShoppingBag },
                  { href: '/my-auctions', label: 'Mes enchères', icon: Gavel },
                  { href: '/messages', label: 'Messages', icon: MessageCircle },
                  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { href: '/profile/edit', label: 'Mon profil', icon: User },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      pathname === href
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-white/[0.03] text-gray-300 hover:bg-white/[0.07] hover:text-white'
                    }`}
                    aria-current={pathname === href ? 'page' : undefined}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm font-semibold text-gray-300"
                >
                  <LogIn size={18} />
                  {t('nav.login')}
                </Link>
                <Link
                  href="/register"
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300"
                >
                  <UserPlus size={18} />
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-1">
              <LanguageSelector />
              <ThemeToggle />
            </div>
            {session && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:border-red-400 hover:bg-red-500/20 hover:text-white"
              >
                <LogOut size={17} />
                Se déconnecter
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
