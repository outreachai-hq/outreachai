import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public — no auth required.
// GET /api/meetings/cancel?token=... cancels a booking via its cancel token.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return new NextResponse(
      htmlPage('Missing token', 'No cancellation token was provided.', false),
      { status: 400, headers: { 'Content-Type': 'text/html' } },
    )
  }

  const booking = await prisma.booking.findUnique({
    where: { cancelToken: token },
    include: { meetingPage: { select: { title: true } } },
  })

  if (!booking) {
    return new NextResponse(
      htmlPage('Invalid link', 'This cancellation link is invalid or has already been used.', false),
      { status: 404, headers: { 'Content-Type': 'text/html' } },
    )
  }

  if (booking.status === 'cancelled') {
    return new NextResponse(
      htmlPage('Already cancelled', 'This booking has already been cancelled.', true),
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'cancelled' },
  })

  const dateStr = booking.startAt.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return new NextResponse(
    htmlPage(
      'Booking cancelled',
      `Your booking on ${dateStr} has been successfully cancelled.`,
      true,
    ),
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  )
}

function htmlPage(title: string, message: string, success: boolean): string {
  const icon = success ? '&#x2705;' : '&#x274C;'
  const color = success ? '#16a34a' : '#dc2626'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — OutreachAI</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 48px 40px; max-width: 420px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 1.5rem; font-weight: 700; color: ${color}; margin: 0 0 8px; }
    p { color: #6b7280; font-size: 0.95rem; margin: 0 0 24px; line-height: 1.5; }
    a { display: inline-block; padding: 10px 24px; background: #4f46e5; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${(process.env.NEXT_PUBLIC_APP_URL ?? '/').replace(/\/$/, '') || '/'}">Go to OutreachAI</a>
  </div>
</body>
</html>`
}
