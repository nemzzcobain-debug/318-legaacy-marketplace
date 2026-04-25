// Endpoint desactive - a supprimer du repo
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ error: 'Endpoint desactive' }, { status: 410 })
}
