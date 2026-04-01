'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Check if dismissed recently (24h)
    const dismissed = localStorage.getItem('pwa-dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) return

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIOSDevice)

    if (isIOSDevice) {
      // Show iOS install banner after 30s
      const timer = setTimeout(() => setShowBanner(true), 30000)
      return () => clearTimeout(timer)
    }

    // Android/Desktop - listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show banner after 15s
      setTimeout(() => setShowBanner(true), 15000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }

    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShowBanner(false)
    setShowIOSGuide(false)
    localStorage.setItem('pwa-dismissed', Date.now().toString())
  }

  if (!showBanner) return null

  return (
    <>
      {/* Install Banner */}
      <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:w-[380px] animate-slide-up">
        <div className="glass rounded-2xl p-4 border border-red-500/20 shadow-2xl shadow-red-500/10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white bg-gradient-to-br from-red-600 to-red-800 shrink-0">
              3
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Installer 318 LEGAACY</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Accède à la marketplace directement depuis ton écran d&apos;accueil
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <Download size={14} />
                  Installer
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={handleDismiss}>
          <div className="w-full max-w-md mx-4 mb-4 glass rounded-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Smartphone size={20} className="text-red-500" />
                Installer sur iOS
              </h3>
              <button onClick={handleDismiss} className="p-1 hover:bg-white/5 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0f]">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">1</div>
                <p className="text-sm text-gray-300">Appuie sur le bouton <strong className="text-white">Partager</strong> (icône carré avec flèche) en bas de Safari</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0f]">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">2</div>
                <p className="text-sm text-gray-300">Scroll et appuie sur <strong className="text-white">&quot;Sur l&apos;écran d&apos;accueil&quot;</strong></p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0f]">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">3</div>
                <p className="text-sm text-gray-300">Appuie sur <strong className="text-white">Ajouter</strong> en haut à droite</p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </>
  )
}
