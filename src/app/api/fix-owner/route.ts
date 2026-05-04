// Endpoint désactivé - a supprimer du repo
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ error: 'Endpoint désactivé' }, { status: 410 })
}
