import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminKey = req.headers.get('x-admin-key')
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { status } = await req.json()
  const allowed = ['open', 'in_progress', 'resolved', 'wont_fix']
  if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const issue = await prisma.issueReport.update({ where: { id }, data: { status } })
  return NextResponse.json(issue)
}
