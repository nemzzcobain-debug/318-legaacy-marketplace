'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Gavel, Loader2, ShieldAlert } from 'lucide-react'
import Header from '@/components/layout/Header'
import CreateAuctionForm from '@/components/dashboard/CreateAuctionForm'

export default function NewAuctionPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const canCreateAuction = userRole === 'PRODUCER' || userRole === 'ADMIN'

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#08080a]">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={34} className="animate-spin text-red-500" />
        </div>
      </div>
    )
  }

  if (!session || !canCreateAuction) {
    return (
      <div className="min-h-screen bg-[#08080a] text-white">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <ShieldAlert size={44} className="mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-black">Accès réservé aux beatmakers</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Connecte-toi avec un compte producteur approuvé pour ajouter une enchère.
          </p>
          <Link
            href={session ? '/marketplace' : '/login'}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            {session ? 'Retour aux enchères' : 'Se connecter'}
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08080a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_20%_0%,rgba(225,29,72,0.16),transparent_42%)]"
      />
      <Header />

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Link
          href="/marketplace"
          className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-zinc-300 transition hover:border-red-500/30 hover:text-white"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Retour aux enchères en direct
        </Link>

        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
            <Gavel size={13} aria-hidden="true" />
            Nouvelle enchère
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Ajouter une enchère</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Sélectionne un beat déjà validé, définis les conditions de vente et publie ton enchère.
          </p>
        </div>

        <CreateAuctionForm
          initiallyOpen
          onCreated={() => router.push('/marketplace')}
        />
      </main>
    </div>
  )
}
