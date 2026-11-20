import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'
import { SESClient, VerifyEmailIdentityCommand } from '@aws-sdk/client-ses'
import sgMail from '@sendgrid/mail'
import { safeDecrypt } from '@/lib/encryption'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Account ID required' }, { status: 400 })

  try {
    const account = await prisma.emailAccount.findFirst({
      where: { id, userId: session.user!.id },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    let message = 'Connection successful!'

    if (account.provider === 'ses') {
      const accessKeyId = safeDecrypt(account.awsAccessKeyId)
      const secretAccessKey = safeDecrypt(account.awsSecretAccessKey)

      if (!accessKeyId || !secretAccessKey) {
        return NextResponse.json({ message: 'SES credentials encrypted — cannot verify. Check AWS credentials.' }, { status: 200 })
      }

      const client = new SESClient({
        region: account.awsRegion || 'us-east-1',
        credentials: { accessKeyId, secretAccessKey },
      })

      await client.send(new VerifyEmailIdentityCommand({ EmailAddress: account.email }))
      message = 'AWS SES connection verified!'
    } else if (account.provider === 'sendgrid') {
      const apiKey = safeDecrypt(account.sendgridApiKey)

      if (!apiKey) {
        return NextResponse.json({ message: 'SendGrid API key encrypted — cannot verify. Check API key.' }, { status: 200 })
      }

      sgMail.setApiKey(apiKey)
      const userEmail = session.user.email as string
      await sgMail.send({
        from: account.email,
        to: userEmail,
        subject: 'OutreachAI Test Email',
        html: '<p>If you see this, your SendGrid connection works! ✅</p>',
      })
      message = 'SendGrid connection verified! Test email sent.'
    } else {
      // SMTP
      const transport = nodemailer.createTransport({
        host: account.smtpHost!,
        port: account.smtpPort ?? 587,
        secure: (account.smtpPort ?? 587) === 465,
        auth: {
          user: account.smtpUser!,
          pass: safeDecrypt(account.smtpPass) ?? '',
        },
      })

      await transport.verify()
      message = 'SMTP connection verified!'
    }

    return NextResponse.json({ message, status: 'success' }, { status: 200 })
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error)
    console.error('[email-test]', err)
    return NextResponse.json(
      { message: `Connection failed: ${err}` },
      { status: 400 }
    )
  }
}
