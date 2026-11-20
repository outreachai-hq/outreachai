import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { encrypt, safeDecrypt } from '@/lib/encryption'

function maskKey(val: string | null | undefined): string | null {
  if (!val) return null
  const dec = safeDecrypt(val)
  if (!dec || dec.length <= 4) return '****'
  return `${'*'.repeat(Math.max(dec.length - 4, 8))}${dec.slice(-4)}`
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await prisma.emailAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, provider: true, name: true, email: true,
      smtpHost: true, smtpPort: true, smtpUser: true,
      awsRegion: true, awsAccessKeyId: true,
      isDefault: true, dailyLimit: true, signature: true,
      warmupActive: true, createdAt: true,
    },
  })
  // Mask encrypted key — never return raw encrypted value to client
  const accounts = raw.map((a) => ({
    ...a,
    awsAccessKeyId: maskKey(a.awsAccessKeyId),
  }))
  return NextResponse.json({ accounts })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, dailyLimit, signature, warmupActive, isDefault } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await prisma.emailAccount.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // When toggling isDefault on, atomically clear it on the others.
  if (isDefault === true) {
    await prisma.$transaction([
      prisma.emailAccount.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } }),
      prisma.emailAccount.update({ where: { id }, data: { isDefault: true } }),
    ])
  }

  const updated = await prisma.emailAccount.update({
    where: { id },
    data: {
      ...(dailyLimit   !== undefined && { dailyLimit: Math.max(0, Math.min(100_000, Number(dailyLimit))) }),
      ...(signature    !== undefined && { signature: signature === '' ? null : String(signature) }),
      ...(warmupActive !== undefined && { warmupActive: Boolean(warmupActive) }),
    },
    select: {
      id: true,
      provider: true,
      name: true,
      email: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      isDefault: true,
      dailyLimit: true,
      signature: true,
      warmupActive: true,
    },
  })
  return NextResponse.json({ account: updated })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, provider = 'smtp', smtpHost, smtpPort, smtpUser, smtpPass,
          awsRegion, awsAccessKeyId, awsSecretAccessKey, sendgridApiKey } = body

  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  if (provider === 'smtp' && (!smtpHost || !smtpPort || !smtpUser || !smtpPass))
    return NextResponse.json({ error: 'SMTP credentials required' }, { status: 400 })
  if (provider === 'ses' && (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey))
    return NextResponse.json({ error: 'AWS Region, Access Key ID and Secret Access Key required' }, { status: 400 })
  if (provider === 'sendgrid' && !sendgridApiKey)
    return NextResponse.json({ error: 'SendGrid API key required' }, { status: 400 })

  const count = await prisma.emailAccount.count({ where: { userId } })
  const account = await prisma.emailAccount.create({
    data: {
      userId, name, email, provider,
      // SMTP
      smtpHost:  provider === 'smtp' ? smtpHost  : null,
      smtpPort:  provider === 'smtp' ? Number(smtpPort) : null,
      smtpUser:  provider === 'smtp' ? smtpUser  : null,
      smtpPass:  provider === 'smtp' && smtpPass ? encrypt(smtpPass) : null,
      // SES — all three fields encrypted at rest
      awsRegion:          provider === 'ses' ? awsRegion                      : null,
      awsAccessKeyId:     provider === 'ses' ? encrypt(awsAccessKeyId)        : null,
      awsSecretAccessKey: provider === 'ses' ? encrypt(awsSecretAccessKey)    : null,
      // SendGrid — API key encrypted at rest
      sendgridApiKey: provider === 'sendgrid' ? encrypt(sendgridApiKey) : null,
      isDefault: count === 0,
    },
    select: {
      id: true, provider: true, name: true, email: true,
      smtpHost: true, smtpPort: true, smtpUser: true,
      awsRegion: true, isDefault: true,
    },
  })
  return NextResponse.json({ account }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.emailAccount.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
