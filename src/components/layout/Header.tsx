'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Gavel, Users, LogIn, UserPlus, Menu, X, LayoutDashboard, Upload, Shield, LogOut, MessageCircle, Search } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession()

  const user = session?.user as any
  const isProducer = user?.role === 'PRODUCER' || user?.role === 'ADMIN'

  const navItems = [
    { href: '/marketplace', label: 'Encheres', icon: Gavel },
    { href: '/search', label: 'Recherche', icon: Search },
    { href: '/producers', label: 'Producteurs', icon: Users },
  ]

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg text-white bg-gradient-to-br from-red-600 to-red-800"
          >
            3
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-sm tracking-tight">318 LEGAACY</span>
            <span className="block text-[10px] text-red-500 -mt-0.5 tracking-[3px] font-semibold">
              MARKETPLACE
            </span>
          </div>
        </Link>

        {/* Nav Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-0.5 border-b-2 transition-colors ${
                pathname === href
                  ? 'text-red-500 border-red-500'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
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
                  <Upload size={14} /> Upload
                </Link>
              )}

              {/* Admin link */}
              {user?.role === 'ADMIN' && (
                <Link href="/admin" className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Admin">
                  <Shield size={20} className="text-orange-400" />
                </Link>
              )}

              <Link href="/my-auctions" className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Mes Enchères">
                <Gavel size={20} className="text-gray-400" />
              </Link>
              <Link href="/messages" className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Messages">
                <MessageCircle size={20} className="text-gray-400" />
              </Link>
              <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <LayoutDashboard size={20} className="text-gray-400" />
              </Link>
              <NotificationBell />

              {/* User avatar + logout */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.[0] || 'U'}
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  title="Deconnexion"
                >
                  <LogOut size={18} className="text-gray-500" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1e1e2e] text-sm font-semibold text-white hover:border-red-500 transition-colors"
              >
                <LogIn size={14} /> Connexion
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <UserPlus size={14} /> <span className="hidden sm:inline">S&apos;inscrire</span>
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 ml-1"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1e1e2e] px-4 py-3 flex flex-col gap-2">
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
          {session && isProducer && (
            <Link
              href="/producers/upload"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Upload size={16} /> Upload un beat
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
