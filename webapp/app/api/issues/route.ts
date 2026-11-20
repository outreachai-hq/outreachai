import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'outreachai.in@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, type, email, url } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  if (title.trim().length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 })

  const userAgent = req.headers.get('user-agent') ?? undefined

  const issue = await prisma.issueReport.create({
    data: {
      title:       title.trim(),
      description: description.trim(),
      type:        ['bug', 'feature', 'other'].includes(type) ? type : 'bug',
      email:       email?.trim() || null,
      url:         url?.trim() || null,
      userAgent,
    },
  })

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const typeLabel = issue.type === 'bug' ? '🐛 Bug' : issue.type === 'feature' ? '✨ Feature' : '💬 Other'
    resend.emails.send({
      from: 'OutReachAI Issues <noreply@outreachai.in>',
      to:   OWNER_EMAIL,
      subject: `[${typeLabel}] ${issue.title}`,
      html: `<h2>${typeLabel}: ${issue.title}</h2>
<p><strong>From:</strong> ${issue.email ?? 'anonymous'}</p>
<p><strong>Page:</strong> ${issue.url ?? 'not provided'}</p>
<hr/>
<p>${issue.description.replace(/\n/g, '<br>')}</p>
<hr/>
<p style="font-size:12px;color:#888">ID: ${issue.id} · <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/issues">View all</a></p>`,
    }).catch(() => {})
  }

  return NextResponse.json({ id: issue.id, success: true }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const issues = await prisma.issueReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json(issues)
}
