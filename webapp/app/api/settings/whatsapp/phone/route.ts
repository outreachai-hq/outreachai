import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

async function getWaCredentials(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { waApiKey: true, waPhone: true, waBaseUrl: true },
  })
  const apiKey  = user?.waApiKey  ? (safeDecrypt(user.waApiKey) ?? null)  : null
  const phone   = user?.waPhone   ?? null
  const baseUrl = user?.waBaseUrl ?? null
  return { apiKey, phone, baseUrl }
}

function waHeaders(apiKey: string, phone?: string | null): HeadersInit {
  const h: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (phone) (h as Record<string, string>)['x-phone'] = phone
  return h
}

// GET — list all phones for this org
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apiKey, baseUrl } = await getWaCredentials(session.user.id)
  if (!apiKey || !baseUrl)
    return NextResponse.json({ error: 'WhatsApp not configured — add your API key and base URL first.' }, { status: 400 })

  const res = await fetch(`${baseUrl}/api/v2/wa/phones/all`, { headers: waHeaders(apiKey) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Failed to list phones' }, { status: res.status })

  const phones: { phone_id: string; org_phone: string | null; wa_state: string; is_ready: boolean; qr_code: string | null }[] =
    Array.isArray(data) ? data : (data?.data ?? [])
  return NextResponse.json(phones)
}

// POST — create a new phone session, or restart/delete one
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, phone } = await req.json().catch(() => ({}))
  const { apiKey, baseUrl } = await getWaCredentials(session.user.id)
  if (!apiKey || !baseUrl)
    return NextResponse.json({ error: 'WhatsApp not configured.' }, { status: 400 })

  if (action === 'create') {
    const res  = await fetch(`${baseUrl}/api/v2/wa/phones/create`, { method: 'POST', headers: waHeaders(apiKey) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Failed to create phone' }, { status: res.status })
    return NextResponse.json(data)
  }

  if (action === 'restart' && phone) {
    const res  = await fetch(`${baseUrl}/api/v2/wa/phones/restart`, { method: 'POST', headers: waHeaders(apiKey, phone) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Failed to restart' }, { status: res.status })
    return NextResponse.json(data)
  }

  if (action === 'delete' && phone) {
    const res  = await fetch(`${baseUrl}/api/v2/wa/phones/delete`, { method: 'DELETE', headers: waHeaders(apiKey, phone) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Failed to delete' }, { status: res.status })
    // If the deleted phone was the configured one, clear waPhone
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { waPhone: true } })
    if (user?.waPhone === phone) {
      await prisma.user.update({ where: { id: session.user.id }, data: { waPhone: null } })
    }
    return NextResponse.json(data)
  }

  if (action === 'save_phone' && phone) {
    // Called by the UI when a phone transitions to CONNECTED — persists waPhone
    await prisma.user.update({ where: { id: session.user.id }, data: { waPhone: phone } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
