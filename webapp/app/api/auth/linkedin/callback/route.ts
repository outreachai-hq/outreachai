import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForToken, getLinkedInProfile, encryptToken, getUserLinkedInCredentials } from '@/lib/linkedin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const app   = process.env.NEXT_PUBLIC_APP_URL!

  if (error) return NextResponse.redirect(`${app}/settings?linkedin_error=${encodeURIComponent(error)}`)
  if (!code || !state) return NextResponse.redirect(`${app}/settings?linkedin_error=missing_params`)

  let userId: string
  try {
    userId = JSON.parse(Buffer.from(state, 'base64url').toString()).userId
    if (!userId) throw new Error()
  } catch {
    return NextResponse.redirect(`${app}/settings?linkedin_error=invalid_state`)
  }

  try {
    const creds = await getUserLinkedInCredentials(userId)
    if (!creds) return NextResponse.redirect(`${app}/settings?linkedin_error=not_configured`)

    const tokenData = await exchangeCodeForToken(code, creds.clientId, creds.clientSecret)
    const profile   = await getLinkedInProfile(tokenData.access_token)
    const tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000)
    const scope = (tokenData as { scope?: string }).scope ?? null

    const existing = await prisma.linkedInAccount.findFirst({
      where: { userId, linkedInMemberId: profile.sub },
    })

    if (existing) {
      await prisma.linkedInAccount.update({
        where: { id: existing.id },
        data: {
          accessToken:  encryptToken(tokenData.access_token),
          refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
          tokenExpiry,
          linkedInScope: scope,
          name:  profile.name  || existing.name,
          email: profile.email || existing.email,
        },
      })
    } else {
      const defaultAccount = await prisma.linkedInAccount.findFirst({
        where: { userId, isDefault: true, linkedInMemberId: null },
      })
      if (defaultAccount) {
        await prisma.linkedInAccount.update({
          where: { id: defaultAccount.id },
          data: {
            linkedInMemberId: profile.sub,
            accessToken:  encryptToken(tokenData.access_token),
            refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
            tokenExpiry,
            linkedInScope: scope,
            name:  profile.name  || defaultAccount.name,
            email: profile.email || defaultAccount.email,
            avatarColor: '#0A66C2',
            isDefault: true,
          },
        })
      } else {
        await prisma.linkedInAccount.create({
          data: {
            userId,
            linkedInMemberId: profile.sub,
            accessToken:  encryptToken(tokenData.access_token),
            refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
            tokenExpiry,
            linkedInScope: scope,
            name:        profile.name,
            email:       profile.email,
            avatarColor: '#0A66C2',
            isDefault:   true,
          },
        })
      }
    }

    return NextResponse.redirect(`${app}/schedule?connected=true`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(`${app}/settings?linkedin_error=${encodeURIComponent(msg)}`)
  }
}
