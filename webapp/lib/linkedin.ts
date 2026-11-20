import { encrypt, decrypt, safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import type { LinkedInAccount } from '@prisma/client'

const LINKEDIN_API = 'https://api.linkedin.com/v2'

export async function getUserLinkedInCredentials(userId: string): Promise<{ clientId: string; clientSecret: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linkedInClientId: true, linkedInClientSecret: true },
  })
  const clientId = user?.linkedInClientId ? safeDecrypt(user.linkedInClientId) : null
  const clientSecret = user?.linkedInClientSecret ? safeDecrypt(user.linkedInClientSecret) : null
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function getLinkedInOAuthUrl(state: string, clientId: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`,
    scope: 'openid profile email w_member_social',
    state,
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; expires_in: number; refresh_token?: string }>
}

export async function getLinkedInProfile(accessToken: string) {
  const res = await fetch(`${LINKEDIN_API}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`LinkedIn userinfo failed: ${res.status}`)
  return res.json() as Promise<{ sub: string; name: string; email: string; picture?: string }>
}

export async function postToLinkedIn(
  accessToken: string,
  linkedInMemberId: string,
  content: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:person:${linkedInMemberId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (res.status === 401) return { success: false, error: 'token_expired' }
  if (!res.ok) {
    let body: { message?: string } = {}
    try { body = await res.json() } catch { /* ignore */ }
    return { success: false, error: body.message ?? 'LinkedIn API error' }
  }
  const data = await res.json() as { id?: string }
  const postId = data.id ?? res.headers.get('X-RestLi-Id') ?? res.headers.get('x-restli-id') ?? undefined
  return { success: true, postId }
}

export const encryptToken = (t: string) => encrypt(t)
export const decryptToken = (t: string) => decrypt(t)

// Refreshes a LinkedIn access token using refresh_token.
// Returns the new decrypted access token string, or null if refresh fails.
export async function refreshLinkedInToken(account: LinkedInAccount): Promise<string | null> {
  const creds = await getUserLinkedInCredentials(account.userId)
  if (!creds) return null
  const rawRefresh = safeDecrypt(account.refreshToken)
  if (!rawRefresh) return null
  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: rawRefresh,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { access_token: string; expires_in: number; refresh_token?: string }
    await prisma.linkedInAccount.update({
      where: { id: account.id },
      data: {
        accessToken:  encrypt(data.access_token),
        tokenExpiry:  new Date(Date.now() + data.expires_in * 1000),
        // Persist new refresh token if LinkedIn rotates it
        ...(data.refresh_token ? { refreshToken: encrypt(data.refresh_token) } : {}),
      },
    })
    return data.access_token
  } catch {
    return null
  }
}

// Gets a valid decrypted access token for an account, refreshing if expired.
// Returns null if unavailable or user must re-connect.
export async function getLinkedInAccessToken(accountId: string): Promise<string | null> {
  const account = await prisma.linkedInAccount.findUnique({ where: { id: accountId } })
  if (!account?.accessToken) return null

  const fiveMinBuffer = 5 * 60 * 1000
  const isExpired = !account.tokenExpiry || account.tokenExpiry.getTime() < Date.now() + fiveMinBuffer

  if (isExpired) {
    if (account.refreshToken) return refreshLinkedInToken(account)
    return null // user must re-connect
  }

  return safeDecrypt(account.accessToken)
}
