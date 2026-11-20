import { NextResponse } from 'next/server'
import { TRIGGERS } from '@/lib/workflowCatalog'

// GET — returns the triggers catalogue for the UI picker
// No auth needed — static data
export async function GET() {
  return NextResponse.json({ triggers: TRIGGERS })
}
