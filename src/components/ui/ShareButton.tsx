'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2, Link2, Check, X as XIcon } from 'lucide-react'

interface ShareButtonProps {
  url: string
  title: string
  description?: string
  size?: 'sm' | 'md'
}

// Twitter (X) icon as SVG
function TwitterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// Facebook icon as SVG
function FacebookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

// WhatsApp icon as SVG
function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const BASE_URL = 'https://www.318marketplace.com'

export default function ShareButton({ url, title, description, size = 'md' }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
  const encodedUrl = encodeURIComponent(fullUrl)
  const encodedTitle = encodeURIComponent(title)
  const encodedDesc = encodeURIComponent(description || title)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1500)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = fullUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1500)
    }
  }

  const shareLinks = [
    {
      label: copied ? 'Copie !' : 'Copier le lien',
      icon: copied ? <Check size={14} className="text-green-400" /> : <Link2 size={14} />,
      onClick: copyLink,
      color: copied ? 'text-green-400' : 'text-white',
    },
    {
      label: 'Twitter / X',
      icon: <TwitterIcon size={14} />,
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'text-white',
    },
    {
      label: 'Facebook',
      icon: <FacebookIcon size={14} />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'text-[#1877F2]',
    },
    {
      label: 'WhatsApp',
      icon: <WhatsAppIcon size={14} />,
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'text-[#25D366]',
    },
  ]

  const btnSize = size === 'sm'
    ? 'w-8 h-8'
    : 'w-9 h-9'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`${btnSize} rounded-lg bg-white/5 border border-[#222222] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all`}
        aria-label="Partager"
        aria-expanded={open}
        aria-controls="share-menu"
      >
        <Share2 size={size === 'sm' ? 14 : 16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e] shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200" id="share-menu" role="dialog" aria-modal="true" aria-label="Menu de partage">
          <div className="p-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">
              Partager
            </div>
            {shareLinks.map((link, i) => (
              link.href ? (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${link.color} hover:bg-white/5 transition-colors`}
                  onClick={() => setOpen(false)}
                >
                  {link.icon}
                  {link.label}
                </a>
              ) : (
                <button
                  key={i}
                  onClick={link.onClick}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${link.color} hover:bg-white/5 transition-colors w-full text-left`}
                >
                  {link.icon}
                  {link.label}
                </button>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
