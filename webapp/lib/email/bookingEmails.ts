import { Resend } from 'resend'
import { buildICS } from '@/lib/calendarInvite'

interface BookingEmailOpts {
  booking: {
    id: string
    guestName: string
    guestEmail: string
    startAt: Date
    endAt: Date
    notes: string | null
  }
  page: {
    title: string
    duration: number
    timezone: string
  }
  ownerName: string
  ownerEmail: string
  cancelUrl: string
}

export async function sendBookingEmails(opts: BookingEmailOpts): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const { booking, page, ownerName, ownerEmail, cancelUrl } = opts

  const ics = buildICS({
    uid: booking.id,
    title: `${page.title} — ${booking.guestName} & ${ownerName}`,
    description: [
      `${page.duration}-minute meeting`,
      booking.notes ? `Notes: ${booking.notes}` : '',
      `Cancel: ${cancelUrl}`,
    ].filter(Boolean).join('\n'),
    startAt: booking.startAt,
    endAt: booking.endAt,
    organizerName: ownerName,
    organizerEmail: ownerEmail,
    attendeeEmail: booking.guestEmail,
    attendeeName: booking.guestName,
  })

  const dateStr = booking.startAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: page.timezone,
    timeZoneName: 'short',
  })

  const icsAttachment = {
    filename: 'invite.ics',
    content: Buffer.from(ics).toString('base64'),
    type: 'text/calendar',
  }

  const guestHtml = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2>Your meeting is confirmed ✅</h2>
      <p><strong>${page.title}</strong></p>
      <p>📅 ${dateStr}</p>
      <p>⏱ ${page.duration} minutes with ${ownerName}</p>
      ${booking.notes ? `<p>📝 Your notes: ${booking.notes}</p>` : ''}
      <p>The calendar invite is attached — accept it to add to your calendar.</p>
      <p><a href="${cancelUrl}" style="color:#6b7280;font-size:12px">Need to cancel?</a></p>
    </div>
  `

  const hostHtml = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2>New booking: ${booking.guestName}</h2>
      <p>📅 ${dateStr}</p>
      <p>📧 ${booking.guestEmail}</p>
      ${booking.notes ? `<p>📝 "${booking.notes}"</p>` : ''}
      <p>The calendar invite is attached.</p>
    </div>
  `

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    await Promise.all([
      resend.emails.send({
        from: 'OutReachAI <noreply@outreachai.in>',
        to: booking.guestEmail,
        subject: `Meeting confirmed: ${page.title} on ${dateStr}`,
        html: guestHtml,
        attachments: [icsAttachment],
      }),
      resend.emails.send({
        from: 'OutReachAI <noreply@outreachai.in>',
        to: ownerEmail,
        subject: `New booking from ${booking.guestName}: ${page.title}`,
        html: hostHtml,
        attachments: [icsAttachment],
      }),
    ])
  } catch {
    // non-fatal — booking is already created; email failure should not surface to the guest
  }
}
