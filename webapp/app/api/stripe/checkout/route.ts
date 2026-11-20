import { NextResponse } from 'next/server'

// Billing is paused during the free beta launch on Product Hunt.
// Stripe checkout is disabled — all features are free for everyone.
export async function POST() {
  return NextResponse.json(
    { error: 'Billing is not active during the free beta. All features are available for free!' },
    { status: 503 }
  )
}
