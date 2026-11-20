// Unified email transport — abstracts SMTP (nodemailer), AWS SES, and SendGrid
// so the rest of the codebase never branches on provider.

import nodemailer from 'nodemailer'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import sgMail from '@sendgrid/mail'
import { safeDecrypt } from '@/lib/encryption'

export interface EmailAccount {
  id: string
  provider: string
  name: string
  email: string
  // SMTP
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  // SES
  awsRegion?: string | null
  awsAccessKeyId?: string | null
  awsSecretAccessKey?: string | null
  sesConfigurationSet?: string | null
  // SendGrid
  sendgridApiKey?: string | null
  signature?: string | null
}

export interface SendOptions {
  to: string
  subject: string
  html: string
  text?: string
  // List-Unsubscribe URL — required for bulk sends (RFC 8058 + Gmail compliance)
  listUnsubscribeUrl?: string
}

// Returns the provider message ID (SES MessageId, etc.) for event correlation
export async function sendViaAccount(account: EmailAccount, opts: SendOptions): Promise<{ messageId?: string }> {
  if (account.provider === 'ses') {
    return sendViaSes(account, opts)
  } else if (account.provider === 'sendgrid') {
    await sendViaSendGrid(account, opts)
    return {}
  } else {
    await sendViaSmtp(account, opts)
    return {}
  }
}

// ── SMTP ──────────────────────────────────────────────────────────────────────

async function sendViaSmtp(account: EmailAccount, opts: SendOptions): Promise<void> {
  const transport = nodemailer.createTransport({
    host: account.smtpHost!,
    port: account.smtpPort ?? 587,
    secure: (account.smtpPort ?? 587) === 465,
    auth: { user: account.smtpUser!, pass: safeDecrypt(account.smtpPass) ?? '' },
  })
  await transport.sendMail({
    from: `"${account.name}" <${account.email}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    html: opts.html,
    ...(opts.listUnsubscribeUrl && {
      headers: {
        'List-Unsubscribe': `<${opts.listUnsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
}

// ── SES ───────────────────────────────────────────────────────────────────────

async function sendViaSes(account: EmailAccount, opts: SendOptions): Promise<{ messageId?: string }> {
  const accessKeyId     = safeDecrypt(account.awsAccessKeyId)
  const secretAccessKey = safeDecrypt(account.awsSecretAccessKey)

  if (!accessKeyId || !secretAccessKey || !account.awsRegion) {
    throw new Error('SES credentials incomplete — check awsRegion, awsAccessKeyId, awsSecretAccessKey')
  }

  const client = new SESClient({
    region: account.awsRegion,
    credentials: { accessKeyId, secretAccessKey },
  })

  const configSet = account.sesConfigurationSet ?? 'mytaxesfilings-bulk'
  const from      = `"${account.name}" <${account.email}>`

  // Always use SendEmailCommand — SendRawEmailCommand does not fire
  // configuration set events (bounce/complaint/delivery → SNS → SQS),
  // making the entire event pipeline blind. SES v1 SendEmailCommand
  // does not support custom headers, so List-Unsubscribe lives in the
  // email body only (already injected by injectTracking in the worker).
  // Upgrade to @aws-sdk/client-sesv2 when header support is needed.
  const result = await client.send(new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [opts.to] },
    Message: {
      Subject: { Data: opts.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: opts.html, Charset: 'UTF-8' },
        Text: { Data: opts.text ?? opts.html.replace(/<[^>]+>/g, ''), Charset: 'UTF-8' },
      },
    },
    ConfigurationSetName: configSet,
  }))

  return { messageId: result.MessageId }
}

// ── SendGrid ──────────────────────────────────────────────────────────────────

async function sendViaSendGrid(account: EmailAccount, opts: SendOptions): Promise<void> {
  const apiKey = safeDecrypt(account.sendgridApiKey)
  if (!apiKey) throw new Error('SendGrid API key missing or could not be decrypted')

  sgMail.setApiKey(apiKey)
  await sgMail.send({
    from: { name: account.name, email: account.email },
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
  })
}

// ── SES bounce classification ─────────────────────────────────────────────────
// SES throws MessageRejected for invalid recipient addresses.
// Combine with the existing SMTP isPermanentBounce check.

export function isSESPermanentBounce(err: unknown): boolean {
  const name = (err as { name?: string })?.name
  return name === 'MessageRejected' || name === 'InvalidParameterValue'
}

// SendGrid throws an error with code 400 for bad recipient addresses
export function isSendGridPermanentBounce(err: unknown): boolean {
  const code = (err as { code?: number })?.code
  const status = (err as { response?: { statusCode?: number } })?.response?.statusCode
  return code === 400 || status === 400 || status === 422
}
