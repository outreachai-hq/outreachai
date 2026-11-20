// Generates an iCalendar (.ics) string for a booking event.
// The returned string can be attached to emails as text/calendar.

export function buildICS(opts: {
  uid: string
  title: string
  description: string
  startAt: Date
  endAt: Date
  organizerName: string
  organizerEmail: string
  attendeeEmail: string
  attendeeName: string
  location?: string
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OutreachAI//Meeting//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@outreachai.in`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.startAt)}`,
    `DTEND:${fmt(opts.endAt)}`,
    `SUMMARY:${opts.title}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}`,
    ...(opts.location ? [`LOCATION:${opts.location}`] : []),
    `ORGANIZER;CN=${opts.organizerName}:mailto:${opts.organizerEmail}`,
    `ATTENDEE;CN=${opts.attendeeName};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}
