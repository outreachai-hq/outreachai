import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { waApiKey: true, waBaseUrl: true },
  })
  const apiKey  = user?.waApiKey  ? (safeDecrypt(user.waApiKey) ?? null)  : null
  const baseUrl = user?.waBaseUrl ?? null
  if (!apiKey || !baseUrl)
    return NextResponse.json({ error: 'WhatsApp not configured.' }, { status: 400 })

  const res = await fetch(`${baseUrl}/api/v2/wa/phones/qr`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'x-phone': phone },
  })
  if (!res.ok) return NextResponse.json({ error: 'QR not ready yet — please wait a moment.' }, { status: 404 })

  const raw = await res.text()
  const dataUrl = await QRCode.toDataURL(raw, { width: 240, margin: 2 })
  return NextResponse.json({ dataUrl })
}
