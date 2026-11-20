import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = process.env.MCP_AUTH_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'MCP not configured' }, { status: 503 })
  }
  return NextResponse.json({ token })
}
