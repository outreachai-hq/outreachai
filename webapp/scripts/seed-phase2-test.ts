/**
 * Seeds test fixtures for Phase 2 testing.
 * Credentials read from env — never hardcoded.
 *
 * Run:
 *   AWS_KEY=<key> AWS_SECRET=<secret> \
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-phase2-test.ts
 */

import { PrismaClient } from '@prisma/client'
import { encrypt } from '../lib/encryption'

const prisma = new PrismaClient()
const RECIPIENT = process.env.TEST_RECIPIENT_EMAIL ?? 'success@simulator.amazonses.com'
const USER_ID = 'cmqnclr7p0000l704vk0alpz3'

async function main() {
  const awsKey    = process.env.AWS_KEY
  const awsSecret = process.env.AWS_SECRET

  if (!awsKey || !awsSecret) {
    console.error('❌ Set AWS_KEY and AWS_SECRET env vars before running')
    process.exit(1)
  }

  // 1. SES email account
  const account = await prisma.emailAccount.upsert({
    where: { id: 'test-ses-account-01' },
    update: {},
    create: {
      id: 'test-ses-account-01',
      userId: USER_ID,
      provider: 'ses',
      name: 'MyTaxesFilings',
      email: 'noreply@mytaxesfilings.com',
      awsRegion: 'ap-south-1',
      awsAccessKeyId: encrypt(awsKey),
      awsSecretAccessKey: encrypt(awsSecret),
      sesConfigurationSet: 'mytaxesfilings-bulk',
      isDefault: true,
      dailyLimit: 500,
    },
  })
  console.log('✅ Email account:', account.id, account.email)

  // 2. Lead list + 1 test lead
  const list = await prisma.leadList.upsert({
    where: { id: 'test-list-01' },
    update: {},
    create: { id: 'test-list-01', userId: USER_ID, name: 'Phase2 Test List' },
  })

  await prisma.lead.upsert({
    where: { id: 'test-lead-01' },
    update: {},
    create: {
      id: 'test-lead-01',
      leadListId: list.id,
      firstName: 'Test',
      lastName: 'Recipient',
      email: RECIPIENT,
      company: 'Example Co',
    },
  })
  console.log('✅ Lead list:', list.id, '| lead:', RECIPIENT)

  // 3. Draft campaign
  const campaign = await prisma.marketingCampaign.upsert({
    where: { id: 'test-campaign-01' },
    update: { status: 'draft' },
    create: {
      id: 'test-campaign-01',
      userId: USER_ID,
      name: 'Phase 2 Test Campaign',
      subject: 'SES bulk send pipeline test ✅',
      htmlBody: [
        '<h1>Hello {{firstName}}!</h1>',
        '<p>This is a test from <strong>mytaxesfilings.com</strong> via AWS SES + BullMQ.</p>',
        '<p><a href="https://mytaxesfilings.com">Visit mytaxesfilings.com</a></p>',
      ].join(''),
      fromName: 'MyTaxesFilings',
      emailAccountId: account.id,
      recipientListId: list.id,
      status: 'draft',
    },
  })
  console.log('✅ Campaign:', campaign.id, `"${campaign.name}"`)
  console.log('\n🎯 Campaign ID:', campaign.id)
  console.log('   Next: POST /api/marketing/campaigns/test-campaign-01/send (with auth cookie)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
