'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  size?: 'sm' | 'md'
}

export default function ThemeToggle({ size = 'sm' }: Props) {
  const { theme, toggleTheme } = useTheme()
  const iconSize = size === 'sm' ? 18 : 22

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-all group"
      title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
    >
      <div className="relative">
        {theme === 'dark' ? (
          <Sun size={iconSize} className="text-yellow-400 group-hover:rotate-45 transition-transform duration-300" />
        ) : (
          <Moon size={iconSize} className="text-indigo-500 group-hover:-rotate-12 transition-transform duration-300" />
        )}
      </div>
    </button>
  )
}
