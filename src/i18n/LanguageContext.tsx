'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import fr from './translations/fr.json'
import en from './translations/en.json'

export type Locale = 'fr' | 'en'

const translations: Record<Locale, typeof fr> = { fr, en }

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'fr',
  setLocale: () => {},
  t: (key: string) => key,
})

// Nested key access: t('hero.title1') => translations.fr.hero.title1
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? path
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr')

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    // Store preference
    if (typeof window !== 'undefined') {
      try { window.localStorage?.setItem('318-lang', newLocale) } catch {}
    }
  }, [])

  const t = useCallback((key: string): string => {
    return getNestedValue(translations[locale], key)
  }, [locale])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useTranslation() {
  const { t, locale } = useContext(LanguageContext)
  return { t, locale }
}
