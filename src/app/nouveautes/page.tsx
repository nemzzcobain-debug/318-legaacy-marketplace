import NouveautesClient from './NouveautesClient'

interface NouveautesPageProps {
  searchParams: Promise<{ beat?: string }>
}

export default async function NouveautesPage({ searchParams }: NouveautesPageProps) {
  const { beat } = await searchParams
  return <NouveautesClient preselectedBeatId={beat ?? null} />
}
