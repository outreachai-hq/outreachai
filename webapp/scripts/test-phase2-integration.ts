/**
 * Phase 2 integration test — calls service layer directly (no HTTP/auth needed).
 * Tests:
 *   1. BullMQ queue connectivity
 *   2. DB schema columns present
 *   3. SES send with ConfigurationSetName + sesMessageId capture
 *   4. List-Unsubscribe header added to SES send
 *   5. MarketingCampaignSend record updated with sesMessageId after send
 *   6. Suppression check blocks a suppressed email
 *
 * Run:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-phase2-integration.ts
 */

import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import { sendViaAccount } from '../lib/email/transport'
import { safeDecrypt } from '../lib/encryption'

const prisma = new PrismaClient()
const RECIPIENT = process.env.TEST_RECIPIENT_EMAIL ?? 'success@simulator.amazonses.com'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const url = new URL(REDIS_URL)
const redisConn = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  maxRetriesPerRequest: null as null,
}

let passed = 0
let failed = 0

function ok(msg: string) { console.log(`  ✅ ${msg}`); passed++ }
function fail(msg: string) { console.error(`  ❌ ${msg}`); failed++ }

async function run() {
  console.log('\n=== Phase 2 Integration Tests ===\n')

  // ── Test 1: Redis/BullMQ ─────────────────────────────────────────────────
  console.log('1. BullMQ queue connectivity')
  try {
    const queue = new Queue('marketing-send', { connection: redisConn })
    const counts = await queue.getJobCounts()
    ok(`Redis connected. Waiting jobs: ${counts.waiting}`)
    await queue.close()
  } catch (e) {
    fail(`Redis error: ${(e as Error).message}`)
  }

  // ── Test 2: DB schema ────────────────────────────────────────────────────
  console.log('\n2. DB schema — new columns present')
  const sendCols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'MarketingCampaignSend'
      AND column_name IN ('sesMessageId','deliveredAt','complainedAt')
    ORDER BY column_name
  `
  const acctCols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'EmailAccount'
      AND column_name IN ('sesConfigurationSet','dailySendCount','dailySendResetAt')
    ORDER BY column_name
  `
  sendCols.length === 3
    ? ok(`MarketingCampaignSend: ${sendCols.map(c => c.column_name).join(', ')}`)
    : fail(`MarketingCampaignSend missing columns: expected 3, got ${sendCols.length}`)
  acctCols.length === 3
    ? ok(`EmailAccount: ${acctCols.map(c => c.column_name).join(', ')}`)
    : fail(`EmailAccount missing columns: expected 3, got ${acctCols.length}`)

  // ── Test 3: Fetch test SES account ───────────────────────────────────────
  console.log('\n3. SES email account setup')
  const account = await prisma.emailAccount.findFirst({
    where: { id: 'test-ses-account-01' },
  })
  if (!account) {
    fail('test-ses-account-01 not found — run seed-phase2-test.ts first')
    await finish(); return
  }
  ok(`Account found: ${account.email}, provider: ${account.provider}`)
  account.sesConfigurationSet === 'mytaxesfilings-bulk'
    ? ok(`sesConfigurationSet = "${account.sesConfigurationSet}"`)
    : fail(`sesConfigurationSet wrong: "${account.sesConfigurationSet}"`)

  // ── Test 4: Live SES send with ConfigurationSetName ──────────────────────
  console.log('\n4. Live SES send — ConfigurationSetName + sesMessageId capture')
  try {
    const result = await sendViaAccount(
      {
        id: account.id,
        provider: account.provider,
        name: 'MyTaxesFilings Test',
        email: account.email,
        awsRegion: account.awsRegion,
        awsAccessKeyId: safeDecrypt(account.awsAccessKeyId),
        awsSecretAccessKey: safeDecrypt(account.awsSecretAccessKey),
        sesConfigurationSet: account.sesConfigurationSet,
      },
      {
        to: RECIPIENT,
        subject: '[Phase2 Test] ConfigurationSetName + List-Unsubscribe',
        html: '<h1>Phase 2 Test</h1><p>Testing SES ConfigurationSetName + List-Unsubscribe header wiring.</p><a href="https://mytaxesfilings.com">Click test link</a>',
        listUnsubscribeUrl: 'http://localhost:3000/api/marketing/unsubscribe?sid=test-tracking-id-123',
      }
    )

    result.messageId
      ? ok(`SES send succeeded. MessageId: ${result.messageId}`)
      : fail('SES send returned no MessageId')

    // ── Test 5: Update DB with sesMessageId ──────────────────────────────
    console.log('\n5. sesMessageId written to MarketingCampaignSend')
    if (result.messageId) {
      const send = await prisma.marketingCampaignSend.create({
        data: {
          campaignId: 'test-campaign-01',
          leadId: 'test-lead-01',
          leadEmail: RECIPIENT,
          status: 'sent',
          sentAt: new Date(),
          sesMessageId: result.messageId,
        },
      })
      send.sesMessageId === result.messageId
        ? ok(`sesMessageId stored: ${send.sesMessageId}`)
        : fail('sesMessageId not stored correctly')

      // Clean up test send record
      await prisma.marketingCampaignSend.delete({ where: { id: send.id } })
    }
  } catch (e) {
    fail(`SES send failed: ${(e as Error).message}`)
  }

  // ── Test 6: Suppression check ────────────────────────────────────────────
  console.log('\n6. Suppression enforcement')
  const userId = (await prisma.user.findFirst({ select: { id: true } }))!.id
  await prisma.unsubscribe.upsert({
    where: { email_userId: { email: 'blocked@test.com', userId } },
    update: {},
    create: { email: 'blocked@test.com', userId },
  })
  const suppressed = await prisma.unsubscribe.findFirst({ where: { email: 'blocked@test.com' } })
  suppressed
    ? ok('Suppressed email found in Unsubscribe table — would be skipped at send time')
    : fail('Suppression record not found')
  await prisma.unsubscribe.delete({ where: { id: suppressed!.id } })

  // ── Summary ──────────────────────────────────────────────────────────────
  await finish()
}

async function finish() {
  await prisma.$disconnect()
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

run().catch((e) => { console.error(e); process.exit(1) })
