/**
 * Seeds an SMTP email account (e.g. Gmail with an app password) for the E2E test user.
 *
 * Usage:
 *   DATABASE_URL=... ENCRYPTION_KEY=... TEST_USER_EMAIL=... TEST_SMTP_USER=... TEST_SMTP_PASS=... npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-email-account.ts
 */
import { PrismaClient } from '@prisma/client'
import { encrypt } from '../lib/encryption'

const prisma = new PrismaClient()

async function main() {
  const TEST_EMAIL = process.env.TEST_USER_EMAIL
  const SMTP_USER  = process.env.TEST_SMTP_USER
  const SMTP_PASS  = process.env.TEST_SMTP_PASS
  if (!TEST_EMAIL || !SMTP_USER || !SMTP_PASS) {
    console.error('❌ Set TEST_USER_EMAIL, TEST_SMTP_USER and TEST_SMTP_PASS')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!user) {
    console.error(`❌ Test user ${TEST_EMAIL} not found — run seed-test-user.ts first`)
    process.exit(1)
  }

  const smtpPass = encrypt(SMTP_PASS)

  const account = await prisma.emailAccount.upsert({
    where:  { id: 'e2e-test-email-account' },
    update: {
      name:     `E2E Test (${SMTP_USER})`,
      email:    SMTP_USER,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: SMTP_USER,
      smtpPass,
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      isDefault: true,
    },
    create: {
      id:       'e2e-test-email-account',
      userId:   user.id,
      name:     `E2E Test (${SMTP_USER})`,
      email:    SMTP_USER,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: SMTP_USER,
      smtpPass,
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      isDefault: true,
    },
  })

  console.log(`✅ Email account ready — id: ${account.id}  email: ${account.email}`)
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
