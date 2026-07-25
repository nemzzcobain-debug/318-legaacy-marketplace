'use client'

import { useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

type PushState =
  | 'checking'
  | 'unsupported'
  | 'needs-install'
  | 'inactive'
  | 'activating'
  | 'active'
  | 'disabling'
  | 'denied'
  | 'error'

function isIOSDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || 'Enregistrement impossible')
  }
}

export default function PushNotificationToggle() {
  const [state, setState] = useState<PushState>('checking')

  useEffect(() => {
    let cancelled = false

    async function checkCurrentDevice() {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelled) setState('unsupported')
        return
      }

      // Sur iPhone/iPad, Web Push est disponible depuis l'application
      // installée sur l'écran d'accueil.
      if (isIOSDevice() && !isStandalone()) {
        if (!cancelled) setState('needs-install')
        return
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied')
        return
      }

      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          // Resynchroniser silencieusement l'appareil avec le compte courant.
          await saveSubscription(subscription)
        }
        if (!cancelled) setState(subscription ? 'active' : 'inactive')
      } catch {
        if (!cancelled) setState('error')
      }
    }

    void checkCurrentDevice()
    return () => {
      cancelled = true
    }
  }, [])

  async function activatePush() {
    setState('activating')

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'inactive')
        return
      }

      const configResponse = await fetch('/api/push-subscriptions', {
        cache: 'no-store',
      })
      const config = await configResponse.json()
      if (!configResponse.ok || !config.publicKey) {
        throw new Error(config.error || 'Notifications non configurées')
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToArrayBuffer(config.publicKey),
        })
      }

      try {
        await saveSubscription(subscription)
      } catch (error) {
        await subscription.unsubscribe()
        throw error
      }

      setState('active')
      toast.success('Notifications activées sur ce téléphone')
    } catch (error) {
      console.error('[WEB_PUSH] Activation impossible:', error)
      setState('error')
      toast.error(error instanceof Error ? error.message : 'Activation impossible')
    }
  }

  async function disablePush() {
    setState('disabling')

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const response = await fetch('/api/push-subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        if (!response.ok) {
          throw new Error('Désactivation impossible')
        }
        await subscription.unsubscribe()
      }

      setState('inactive')
      toast.success('Notifications désactivées sur ce téléphone')
    } catch (error) {
      console.error('[WEB_PUSH] Désactivation impossible:', error)
      setState('active')
      toast.error('Impossible de désactiver les notifications')
    }
  }

  if (state === 'unsupported') return null

  if (state === 'needs-install') {
    return (
      <div className="mx-3 my-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] p-3">
        <div className="flex items-start gap-2.5">
          <Smartphone size={17} className="mt-0.5 shrink-0 text-blue-400" />
          <div>
            <p className="text-xs font-bold text-white">Notifications sur iPhone</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              Ajoute d’abord 318 LEGAACY à ton écran d’accueil, puis ouvre l’application
              installée pour activer les alertes.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="mx-3 my-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.07] p-3">
        <div className="flex items-start gap-2.5">
          <BellOff size={17} className="mt-0.5 shrink-0 text-orange-400" />
          <div>
            <p className="text-xs font-bold text-white">Notifications bloquées</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              Autorise 318 LEGAACY dans les réglages de notifications de ton téléphone.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const busy = state === 'checking' || state === 'activating' || state === 'disabling'
  const active = state === 'active'

  return (
    <div className="mx-3 my-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <BellRing size={17} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white">
          {active ? 'Alertes téléphone activées' : 'Alertes sur ce téléphone'}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-gray-500">
          {active
            ? 'Tu seras prévenu immédiatement si ton offre est dépassée.'
            : state === 'error'
              ? 'Une erreur est survenue. Tu peux réessayer.'
              : 'Reçois les surenchères même lorsque le site est fermé.'}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={active ? disablePush : activatePush}
        className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-50 ${
          active
            ? 'bg-white/5 text-gray-300 hover:bg-white/10'
            : 'bg-red-500 text-white hover:bg-red-600'
        }`}
      >
        {active ? 'Désactiver' : 'Activer'}
      </button>
    </div>
  )
}
