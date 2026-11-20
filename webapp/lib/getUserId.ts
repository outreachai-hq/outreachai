import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { getJwtSecret } from '@/lib/jwtSecret'

export async function getUserId(req?: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id
  if (!req) return null
  const header = req.headers.get('Authorization')
  if (header?.startsWith('Bearer ')) {
    try {
      const { payload } = await jwtVerify(header.slice(7), getJwtSecret())
      if (!payload.sub) return null
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })
      return user?.id ?? null
    } catch { return null }
  }
  return null
}
