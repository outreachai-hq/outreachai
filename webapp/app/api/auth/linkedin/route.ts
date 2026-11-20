import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getLinkedInOAuthUrl, getUserLinkedInCredentials } from '@/lib/linkedin'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getUserLinkedInCredentials(session.user.id)
  if (!creds) {
    const app = process.env.NEXT_PUBLIC_APP_URL!
    return NextResponse.redirect(`${app}/settings?linkedin_error=not_configured`)
  }

  const state = Buffer.from(JSON.stringify({
    userId: session.user.id,
    nonce: crypto.randomUUID(),
  })).toString('base64url')

  return NextResponse.redirect(getLinkedInOAuthUrl(state, creds.clientId))
}
