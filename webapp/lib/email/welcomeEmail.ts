// Shared welcome-email sender. Two call sites use this:
//   - POST /api/auth/register   (credentials signup)
//   - lib/auth.ts events.signIn (first-time OAuth signup)
//
// Both used to inline the same ~10-line HTML block. Centralised here so
// copy/CTA changes happen in one place.

import { Resend } from 'resend'

export async function sendWelcomeEmail(opts: { to: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'OutReachAI <noreply@outreachai.in>',
      to: opts.to,
      subject: "Welcome to OutreachAI — here's how to get started",
      html: `<h2>Welcome to OutreachAI!</h2>
<p>You're now running your own free, all-in-one outreach platform — cold email, LinkedIn automation, marketing broadcasts, and email warmup, all in one place.</p>
<p>Here are your first 3 steps:</p>
<ol>
  <li><a href="${appUrl}/settings">Connect your email account</a> (Gmail, GoDaddy, SES, or any SMTP)</li>
  <li><a href="${appUrl}/leads">Import your first leads</a> from a CSV file</li>
  <li><a href="${appUrl}/campaigns/new">Create your first campaign</a> and launch it</li>
</ol>
<p>Need help? Check the <a href="${appUrl}/features">features overview</a> or reply to this email.</p>
<p>— The OutreachAI team</p>`,
    })
  } catch {
    // non-fatal — signup/login should still succeed if email fails
  }
}
