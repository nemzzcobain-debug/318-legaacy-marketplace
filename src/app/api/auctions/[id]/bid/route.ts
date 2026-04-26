// BUG FIX 6: Route legacy DESACTIVEE — utiliser /api/auctions/bid?auctionId=xxx
// Cette route n'utilisait pas de transaction et causait des race conditions
// Le client (AuctionClient.tsx) a ete mis a jour pour appeler la bonne route

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(
    { error: 'Route desactivee. Utilisez /api/auctions/bid?auctionId=' + params.id },
    { status: 410 }
  )
}
