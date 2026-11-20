import { NextResponse } from 'next/server'
import { ACTIONS } from '@/lib/workflowCatalog'

// GET — returns the actions catalogue for the UI picker
export async function GET() {
  return NextResponse.json({ actions: ACTIONS })
}
