import { Metadata } from 'next'
import NouveautesClient from './NouveautesClient'

export const metadata: Metadata = {
  title: 'Nouveautes - Beats disponibles | 318 LEGAACY',
  description:
    "Decouvre les derniers beats disponibles a l'achat direct avec licence BASIC, PREMIUM ou EXCLUSIVE sur 318 LEGAACY Marketplace.",
}

export default function NouveautesPage() {
  return <NouveautesClient />
}
