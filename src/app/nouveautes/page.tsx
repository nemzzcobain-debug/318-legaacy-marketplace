import { Metadata } from 'next'
import NouveautesClient from './NouveautesClient'

export const metadata: Metadata = {
  title: 'Nouveautes - Beats disponibles | 318 LEGAACY',
  description:
    "Découvre les derniers beats disponibles à l'achat direct avec licence BASIC, PREMIUM ou EXCLUSIVE sur 318 LEGAACY Marketplace.",
}

interface NouveautesPageProps {
  searchParams: Promise<{ beat?: string }>
}

export default async function NouveautesPage({ searchParams }: NouveautesPageProps) {
  const { beat } = await searchParams
  return <NouveautesClient preselectedBeatId={beat ?? null} />
}
