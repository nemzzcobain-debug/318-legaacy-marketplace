'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Gavel, Users, LogIn, UserPlus, Menu, X, LayoutDashboard, Upload, Shield, LogOut, MessageCircle, Search, ShoppingBag, Eye, User, ListMusic } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LanguageSelector from '@/components/ui/LanguageSelector'
import { useTranslation } from '@/i18n/LanguageContext'

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession()
  const { t } = useTranslation()

  const user = session?.user as any
  const isProducer = user?.role === 'PRODUCER' || user?.role === 'ADMIN'

  const navItems = [
    { href: '/marketplace', label: t('nav.auctions'), icon: Gavel },
    { href: '/search', label: t('nav.search'), icon: Search },
    { href: '/producers', label: t('nav.producers'), icon: Users },
  ]

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-318-marketplace.png"
            alt="318 LEGAACY Marketplace"
            width={56}
            height={56}
            className="rounded-lg"
            style={{ maskImage: 'radial-gradient(circle, white 40%, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle, white 40%, transparent 75%)' }}
          />
          <div className="hidden sm:block">
            <span className="font-extrabold text-sm tracking-tight">318 LEGAACY</span>
            <span className="block text-[10px] text-red-500 -mt-0.5 tracking-[3px] font-semibold">
              MARKETPLACE
            </span>
          </div>
        </Link>

        {/* Nav Desktop */}
        <nav className="hidden md:flex items-center gap-6" role="navigation" aria-label="Navigation principale">
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
        <div className="flex items-center gap-2">
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
                <Link href="/admin" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.admin')}>
                  <Shield size={20} className="text-orange-400" />
                </Link>
              )}

              <Link href="/playlists" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.myPlaylists')}>
                <ListMusic size={20} className="text-gray-400" />
              </Link>
              <Link href="/watchlist" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.myWatchlist')}>
                <Eye size={20} className="text-gray-400" />
              </Link>
              <Link href="/purchases" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.myPurchases')}>
                <ShoppingBag size={20} className="text-gray-400" />
              </Link>
              <Link href="/my-auctions" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.myAuctions')}>
                <Gavel size={20} className="text-gray-400" />
              </Link>
              <Link href="/messages" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.messages')}>
                <MessageCircle size={20} className="text-gray-400" />
              </Link>
              <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-lg transition-colors" aria-label={t('nav.dashboard')}>
                <LayoutDashboard size={20} className="text-gray-400" />
              </Link>
              <NotificationBell />
              <LanguageSelector />
              <ThemeToggle />

              {/* User avatar + logout */}
              <div className="flex items-center gap-2">
                <Link href="/profile/edit" className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-xs font-bold text-white hover:ring-2 hover:ring-red-500 transition-all" aria-label={t('nav.profile')}>
                  {user?.name?.[0] || 'U'}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  aria-label={t('nav.logout')}
                >
                  <LogOut size={18} className="text-gray-400" />
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <UserPlus size={14} /> <span className="hidden sm:inline">{t('nav.register')}</span>
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 ml-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1e1e2e] px-4 py-3 flex flex-col gap-2" id="mobile-nav">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                pathname === href
                  ? 'text-red-500 bg-red-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} /> {label}
            </Link>
          ))}
          {session && (
            <Link
              href="/profile/edit"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                pathname === '/profile/edit'
                  ? 'text-red-500 bg-red-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User size={16} /> {t('nav.profile')}
            </Link>
          )}
          {session && isProducer && (
            <Link
              href="/producers/upload"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Upload size={16} /> Upload un beat
            </Link>
          )}
          {/* Language selector mobile */}
          <div className="border-t border-[#1e1e2e] pt-2 mt-1">
            <LanguageSelector />
          </div>
        </div>
      )}
    </header>
  )
}
