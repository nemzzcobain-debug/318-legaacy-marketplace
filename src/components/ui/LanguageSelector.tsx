'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'

interface Language {
  code: string
  label: string
  flag: string
}

const languages: Language[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
]

export default function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Language>(languages[0])
  const ref = useRef<HTMLDivElement>(null)

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
    setSelected(lang)
    setOpen(false)
    // Future: integrate with i18n (next-intl, etc.)
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1e1e2e] hover:border-red-500/50 transition-all duration-200 text-sm group"
        aria-label="Choisir la langue"
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
          aria-label="Langues disponibles"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-[#1e1e2e]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              <Globe size={10} />
              Langue
            </div>
          </div>

          {/* Language list */}
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-all duration-150 ${
                  selected.code === lang.code
                    ? 'bg-red-500/10 text-red-400'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
                role="option"
                aria-selected={selected.code === lang.code}
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
                {selected.code === lang.code && (
                  <svg className="w-4 h-4 ml-auto text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-[#1e1e2e]">
            <p className="text-[10px] text-gray-600 text-center">
              Bientôt disponible dans plus de langues
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
