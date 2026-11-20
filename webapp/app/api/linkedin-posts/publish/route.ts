import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getUserId'
import { runLinkedInPublisher } from '@/lib/linkedin-publisher'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Accept either: logged-in user OR correct cron secret
  const cronSecret = req.headers.get('x-cron-secret')
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET

  if (!isCron) {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runLinkedInPublisher()
  return NextResponse.json(result)
}
