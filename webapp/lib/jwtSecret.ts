// Shared signing key for extension JWTs (issued by /api/extension/auth|signup,
// verified in lib/getUserId.ts).
//
// In production NEXTAUTH_SECRET is required: falling back to a well-known string
// would let anyone forge tokens for any user. The fallback exists only so local
// development and unit tests work without extra setup.
const DEV_FALLBACK = 'dev-secret-change-in-prod'

export function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET
  if (secret) return new TextEncoder().encode(secret)

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET must be set in production')
  }
  return new TextEncoder().encode(DEV_FALLBACK)
}
