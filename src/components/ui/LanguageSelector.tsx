'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useLanguage, type Locale } from '@/i18n/LanguageContext'

interface Language {
  code: Locale
  label: string
  flag: string
}

const languages: Language[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

// Display-only languages (coming soon)
const comingSoonLangs = [
  { label: 'Español', flag: '🇪🇸' },
  { label: 'Deutsch', flag: '🇩🇪' },
  { label: 'Português', flag: '🇧🇷' },
  { label: 'العربية', flag: '🇸🇦' },
  { label: '日本語', flag: '🇯🇵' },
]

export default function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const { locale, setLocale, t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)

  const selected = languages.find(l => l.code === locale) || languages[0]

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (lang: Language) => {
    setLocale(lang.code)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1e1e2e] hover:border-red-500/50 transition-all duration-200 text-sm group"
        aria-label={t('language.choose')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="hidden lg:inline text-xs font-medium text-gray-400 group-hover:text-white transition-colors">
          {selected.code.toUpperCase()}
        </span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#1e1e2e] bg-[#0a0a0f]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
          role="listbox"
          aria-label={t('language.label')}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-[#1e1e2e]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              <Globe size={10} />
              {t('language.label')}
            </div>
          </div>

          {/* Active languages */}
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-all duration-150 ${
                  locale === lang.code
                    ? 'bg-red-500/10 text-red-400'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
                role="option"
                aria-selected={locale === lang.code}
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
                {locale === lang.code && (
                  <svg className="w-4 h-4 ml-auto text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Coming soon languages */}
          <div className="border-t border-[#1e1e2e] py-1">
            {comingSoonLangs.map((lang) => (
              <div
                key={lang.label}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 cursor-default"
              >
                <span className="text-lg leading-none opacity-50">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
                <span className="ml-auto text-[9px] font-bold text-gray-700 bg-white/5 px-1.5 py-0.5 rounded">SOON</span>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-[#1e1e2e]">
            <p className="text-[10px] text-gray-600 text-center">
              {t('language.moreComingSoon')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
