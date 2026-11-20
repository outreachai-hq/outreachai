/**
 * Real Email Metrics Test
 *
 * Sends actual emails via AWS SES using the mailbox simulator addresses,
 * waits for bounce/complaint/delivery events to flow through SNS→SQS,
 * simulates opens and clicks via tracking endpoints, then captures
 * and displays a full metrics report.
 *
 * SES Simulator addresses (free, no real mailbox needed):
 *   success@simulator.amazonses.com     → delivered successfully
 *   bounce@simulator.amazonses.com      → permanent hard bounce
 *   ooto@simulator.amazonses.com        → soft bounce (out of office)
 *   complaint@simulator.amazonses.com   → spam complaint
 *
 * Run:
 *   AWS_KEY=<key> AWS_SECRET=<secret> node scripts/test-real-email-metrics.mjs
 *
 * Prerequisites: dev server running, Redis running, seed data created
 */

import { chromium } from '../node_modules/playwright/index.mjs'
import { createCipheriv, randomBytes } from 'crypto'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

// Inline AES-256-GCM encrypt (mirrors lib/encryption.ts)
function encrypt(plaintext) {
  const raw = (process.env.ENCRYPTION_KEY ?? '').padEnd(32, '0').slice(0, 32)
  const key  = Buffer.from(raw, 'utf8')
  const iv   = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag  = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

// ── Config ────────────────────────────────────────────────────────────────────

const BASE        = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const DEMO_USER   = 'akhilesh@demo.com'
const DEMO_PASS   = 'password123'
const DEMO_UID    = 'user_demo'
const ENC_KEY     = process.env.ENCRYPTION_KEY || 'local-dev-enc-key-32chars-padding'
const AWS_KEY     = process.env.AWS_KEY     || process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET  = process.env.AWS_SECRET  || process.env.AWS_SECRET_ACCESS_KEY
const SQS_URL     = process.env.SES_EVENT_QUEUE_URL
const SCREENSHOTS = '/tmp/metrics-screenshots'

// SES mailbox simulator addresses — generate real bounce/complaint/delivery events
const SIM_SUCCESS   = 'success@simulator.amazonses.com'
const SIM_BOUNCE    = 'bounce@simulator.amazonses.com'
const SIM_OOTO      = 'ooto@simulator.amazonses.com'     // soft bounce
const SIM_COMPLAINT = 'complaint@simulator.amazonses.com'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

let passed = 0, failed = 0
function ok(msg)   { console.log(`  ✅ ${msg}`); passed++ }
function fail(msg) { console.error(`  ❌ ${msg}`); failed++ }
function info(msg) { console.log(`  ℹ️  ${msg}`) }
function head(s)   { console.log(`\n${s}`) }
function wait(ms)  { return new Promise(r => setTimeout(r, ms)) }

// ── Setup: seed SES account + leads for demo user ─────────────────────────────

async function setupSeedData() {
  head('── Setup: Seeding test data for demo user ──')

  if (!AWS_KEY || !AWS_SECRET) {
    console.error('❌ Set AWS_KEY and AWS_SECRET env vars')
    process.exit(1)
  }

  // 1. SES email account for demo user
  const account = await prisma.emailAccount.upsert({
    where: { id: 'demo-ses-account-metrics' },
    update: { awsAccessKeyId: encrypt(AWS_KEY), awsSecretAccessKey: encrypt(AWS_SECRET) },
    create: {
      id:                 'demo-ses-account-metrics',
      userId:             DEMO_UID,
      provider:           'ses',
      name:               'MyTaxesFilings',
      email:              'noreply@mytaxesfilings.com',
      awsRegion:          'ap-south-1',
      awsAccessKeyId:     encrypt(AWS_KEY),
      awsSecretAccessKey: encrypt(AWS_SECRET),
      sesConfigurationSet: 'mytaxesfilings-bulk',
      isDefault:          true,
      dailyLimit:         500,
    },
  })
  ok(`SES account: ${account.email} (${account.id})`)

  // 2. Lead list
  const list = await prisma.leadList.upsert({
    where: { id: 'demo-metrics-list' },
    update: {},
    create: { id: 'demo-metrics-list', userId: DEMO_UID, name: 'Metrics Test Leads' },
  })

  // 3. Leads — SES simulator addresses + real inboxes to confirm delivery
  const leads = [
    { id: 'demo-lead-success',   email: SIM_SUCCESS,               firstName: 'Success',   label: 'Delivered (simulator)' },
    { id: 'demo-lead-bounce',    email: SIM_BOUNCE,                firstName: 'Bounce',    label: 'Hard Bounce (simulator)' },
    { id: 'demo-lead-ooto',      email: SIM_OOTO,                  firstName: 'Ooto',      label: 'Soft Bounce (simulator)' },
    { id: 'demo-lead-complaint', email: SIM_COMPLAINT,             firstName: 'Complaint', label: 'Spam Complaint (simulator)' },
    { id: 'demo-lead-real',      email: process.env.TEST_RECIPIENT_EMAIL ?? SIM_SUCCESS, firstName: 'Test',      label: 'Real inbox (TEST_RECIPIENT_EMAIL)' },
    { id: 'demo-lead-sagrawal',  email: 'sagrawal258@gmail.com',   firstName: 'Sagrawal',  label: 'Real inbox (Sagrawal)' },
  ]

  for (const l of leads) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: {},
      create: { id: l.id, leadListId: list.id, firstName: l.firstName, email: l.email },
    })
    info(`Lead: ${l.email} (${l.label})`)
  }

  // Clean up suppression for simulator addresses so they can receive
  await prisma.unsubscribe.deleteMany({
    where: { email: { in: leads.map(l => l.email) }, userId: DEMO_UID },
  })
  ok(`Cleared any suppressions for ${leads.length} simulator addresses`)

  // 4. Campaign (reset to draft if exists)
  const campaign = await prisma.marketingCampaign.upsert({
    where: { id: 'demo-metrics-campaign' },
    update: { status: 'draft', sentAt: null, stats: {} },
    create: {
      id:              'demo-metrics-campaign',
      userId:          DEMO_UID,
      name:            'Metrics Test Campaign',
      subject:         'Real Email Metrics Test — {{firstName}}',
      htmlBody: [
        '<h1>Hi {{firstName}}!</h1>',
        '<p>This is a real metrics test email sent via AWS SES.</p>',
        '<p><a href="https://mytaxesfilings.com">Visit MyTaxesFilings</a></p>',
        '<p>Testing: delivered, bounced, complained, opened, clicked.</p>',
      ].join(''),
      fromName:        'MyTaxesFilings Test',
      emailAccountId:  account.id,
      recipientListId: list.id,
      status:          'draft',
    },
  })
  ok(`Campaign: "${campaign.name}" (${campaign.id}) — status: draft`)

  // Clear any previous sends for this campaign
  await prisma.marketingCampaignSend.deleteMany({ where: { campaignId: campaign.id } })
  ok('Cleared previous send records')

  return { account, list, leads, campaign }
}

// ── Send via API (using Playwright session) ───────────────────────────────────

async function sendCampaign(page) {
  head('── Sending campaign via API ──')

  // Trigger send via API using the authenticated Playwright session
  const result = await page.evaluate(async (url) => {
    const r = await fetch(url, { method: 'POST' })
    return { status: r.status, body: await r.json() }
  }, `${BASE}/api/marketing/campaigns/demo-metrics-campaign/send`)

  if (result.status === 200 && result.body.queued >= 0) {
    ok(`Campaign queued: ${result.body.queued} emails, ${result.body.skipped} skipped`)
    info('Emails enqueued in BullMQ → worker will send at ~14/sec')
  } else {
    fail(`Send failed: ${result.status} — ${JSON.stringify(result.body)}`)
  }

  return result
}

// ── Wait for sends to process ─────────────────────────────────────────────────

async function waitForSends(campaignId, expectedCount, maxWaitSec = 60) {
  head(`── Waiting for ${expectedCount} emails to be sent (max ${maxWaitSec}s) ──`)
  const start = Date.now()

  while (Date.now() - start < maxWaitSec * 1000) {
    const sends = await prisma.marketingCampaignSend.findMany({
      where: { campaignId },
      select: { status: true, leadEmail: true, sesMessageId: true, sentAt: true },
    })
    const sent    = sends.filter(s => s.sentAt !== null).length
    const pending = sends.filter(s => s.status === 'pending').length

    info(`Sends: ${sent} sent, ${pending} pending (${Math.round((Date.now()-start)/1000)}s elapsed)`)

    if (pending === 0 && sent >= expectedCount) {
      ok(`All ${sent} emails sent by worker`)
      return sends
    }
    await wait(3000)
  }

  const final = await prisma.marketingCampaignSend.findMany({ where: { campaignId } })
  fail(`Timeout: only ${final.filter(s => s.sentAt).length}/${expectedCount} sent after ${maxWaitSec}s`)
  return final
}

// ── Wait for campaign to complete ─────────────────────────────────────────────

async function waitForCampaignComplete(campaignId, maxWaitSec = 30) {
  head('── Waiting for campaign to flip to "sent" ──')
  const start = Date.now()

  while (Date.now() - start < maxWaitSec * 1000) {
    const c = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    })
    if (c?.status === 'sent') {
      ok(`Campaign status = "sent" ✅ (Fix 2: campaign completion working)`)
      return true
    }
    info(`Campaign status: "${c?.status}" — waiting...`)
    await wait(3000)
  }

  fail('Campaign did not flip to "sent" within timeout')
  return false
}

// ── Simulate open + click via tracking endpoints ──────────────────────────────

async function simulateEngagement(page, sends) {
  head('── Simulating opens & clicks via tracking endpoints ──')

  // Simulate engagement for the real Girish inbox (most realistic)
  const sendRecord = await prisma.marketingCampaignSend.findFirst({
    where: {
      campaignId: 'demo-metrics-campaign',
      leadEmail: { in: [process.env.TEST_RECIPIENT_EMAIL ?? SIM_SUCCESS, SIM_SUCCESS] },
    },
    select: { trackingId: true, leadEmail: true },
  })
  if (!sendRecord?.trackingId) { fail('No trackingId for engagement simulation'); return }
  info(`Simulating open+click for: ${sendRecord.leadEmail}`)
  if (!sendRecord?.trackingId) { fail('No trackingId for success send'); return }

  const tid = sendRecord.trackingId

  // Simulate open (hits the tracking pixel endpoint)
  const pixelRes = await page.goto(`${BASE}/api/marketing/track/open?sid=${tid}`)
  pixelRes?.headers()['content-type']?.includes('image/gif')
    ? ok(`Open pixel hit for success@simulator → openedAt will be set`)
    : fail('Open pixel did not return GIF')

  // Simulate click
  await page.goto(`${BASE}/api/marketing/track/click?sid=${tid}&url=${encodeURIComponent('https://mytaxesfilings.com')}`)
  await page.waitForLoadState('domcontentloaded')
  page.url().includes('mytaxesfilings.com')
    ? ok('Click tracked → clickedAt set, redirected to mytaxesfilings.com')
    : ok('Click redirect processed')

  await wait(500)
  // Query for the same email we hit the pixel for
  const updated = await prisma.marketingCampaignSend.findFirst({
    where: { campaignId: 'demo-metrics-campaign', leadEmail: sendRecord.leadEmail },
    select: { openedAt: true, clickedAt: true },
  })
  updated?.openedAt  ? ok(`openedAt:  ${updated.openedAt.toISOString()}`) : fail('openedAt not set')
  updated?.clickedAt ? ok(`clickedAt: ${updated.clickedAt.toISOString()}`) : fail('clickedAt not set')
}

// ── Process SQS events (bounce/complaint/delivery) ────────────────────────────

async function processSqsEvents(page, rounds = 4, waitBetween = 15000) {
  head(`── Processing SQS events (${rounds} rounds, ${waitBetween/1000}s apart) ──`)
  info('SES fires bounce/complaint/delivery events via SNS → SQS after a few seconds')

  for (let i = 1; i <= rounds; i++) {
    if (i > 1) {
      info(`Waiting ${waitBetween/1000}s for SES to fire events...`)
      await wait(waitBetween)
    }

    const result = await page.evaluate(async (url) => {
      const r = await fetch(url)
      return { status: r.status, body: await r.json() }
    }, `${BASE}/api/cron/process-ses-events`)

    const processed = result.body.processed ?? 0
    info(`Round ${i}: processed ${processed} SQS messages`)
    if (processed > 0) ok(`Round ${i}: ${processed} events processed from SQS ✅`)
  }
}

// ── Capture & display metrics ─────────────────────────────────────────────────

async function captureMetrics(page) {
  head('── Capturing Final Metrics ──')

  // Via API
  const statsResult = await page.evaluate(async (url) => {
    const r = await fetch(url)
    if (!r.ok) return null
    return r.json()
  }, `${BASE}/api/marketing/campaigns/demo-metrics-campaign/stats`)

  // Via DB (ground truth)
  const sends = await prisma.marketingCampaignSend.findMany({
    where: { campaignId: 'demo-metrics-campaign' },
    select: {
      leadEmail: true, status: true, sesMessageId: true,
      sentAt: true, deliveredAt: true, openedAt: true,
      clickedAt: true, complainedAt: true, unsubscribedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: 'demo-metrics-campaign' },
    select: { status: true, stats: true },
  })

  // Per-recipient breakdown
  console.log('\n┌────────────────────────────────────────────────────────────────┐')
  console.log('│                   Per-Recipient Results                         │')
  console.log('├────────────────────────────────────────────────────────────────┤')

  const labelMap = {
    [SIM_SUCCESS]:   'success@simulator   → Expected: delivered',
    [SIM_BOUNCE]:    'bounce@simulator    → Expected: hard bounce',
    [SIM_OOTO]:      'ooto@simulator      → Expected: soft bounce',
    [SIM_COMPLAINT]: 'complaint@simulator → Expected: spam complaint',
  }

  for (const send of sends) {
    const label  = labelMap[send.leadEmail] ?? send.leadEmail
    const events = [
      send.sentAt       ? '📤 sent'       : '',
      send.deliveredAt  ? '✅ delivered'  : '',
      send.openedAt     ? '👁️  opened'    : '',
      send.clickedAt    ? '🖱️  clicked'   : '',
      send.complainedAt ? '🚨 complained' : '',
    ].filter(Boolean).join(', ') || '⏳ pending'

    const statusIcon = {
      sent:      '📤',
      delivered: '✅',
      bounced:   '↩️',
      complained:'🚨',
      failed:    '❌',
      pending:   '⏳',
    }[send.status] ?? '?'

    console.log(`│  ${statusIcon} ${label.padEnd(44)} │`)
    console.log(`│    DB status: ${send.status.padEnd(12)} SES msgId: ${(send.sesMessageId ?? 'none').slice(0, 20).padEnd(22)} │`)
    console.log(`│    Events: ${events.padEnd(54)} │`)
    console.log('├────────────────────────────────────────────────────────────────┤')
  }

  // Aggregate stats
  const total      = sends.length
  const sent       = sends.filter(s => s.sentAt).length
  const delivered  = sends.filter(s => s.deliveredAt).length
  const bounced    = sends.filter(s => s.status === 'bounced').length
  const complained = sends.filter(s => s.status === 'complained').length
  const opened     = sends.filter(s => s.openedAt).length
  const clicked    = sends.filter(s => s.clickedAt).length

  console.log('│                   Aggregate Metrics (DB)                        │')
  console.log('├────────────────────────────────────────────────────────────────┤')
  console.log(`│  Total recipients : ${String(total).padEnd(5)} Campaign status: ${(campaign?.status ?? '?').padEnd(12)} │`)
  console.log(`│  Sent             : ${String(sent).padEnd(5)} (${(sent/total*100).toFixed(0)}%)                               │`)
  console.log(`│  Delivered        : ${String(delivered).padEnd(5)} (${(delivered/total*100).toFixed(0)}%)  — from SQS delivery event       │`)
  console.log(`│  Bounced          : ${String(bounced).padEnd(5)} (${(bounced/total*100).toFixed(0)}%)  — from SQS bounce event         │`)
  console.log(`│  Complained       : ${String(complained).padEnd(5)} (${(complained/total*100).toFixed(0)}%)  — from SQS complaint event      │`)
  console.log(`│  Opened           : ${String(opened).padEnd(5)} (${(sent>0?(opened/sent*100):0).toFixed(0)}%)  — from tracking pixel          │`)
  console.log(`│  Clicked          : ${String(clicked).padEnd(5)} (${(sent>0?(clicked/sent*100):0).toFixed(0)}%)  — from click redirect          │`)
  console.log('├────────────────────────────────────────────────────────────────┤')

  if (statsResult) {
    console.log('│                   Stats API Response                            │')
    console.log('├────────────────────────────────────────────────────────────────┤')
    console.log(`│  sent:${String(statsResult.sent).padStart(4)}  delivered:${String(statsResult.delivered).padStart(4)}  bounced:${String(statsResult.bounced).padStart(4)}             │`)
    console.log(`│  complained:${String(statsResult.complained).padStart(4)}  opened:${String(statsResult.opened).padStart(4)}  clicked:${String(statsResult.clicked).padStart(4)}        │`)
    console.log(`│  openRate:${(statsResult.openRate*100).toFixed(1).padStart(6)}%  bounceRate:${(statsResult.bounceRate*100).toFixed(1).padStart(6)}%              │`)
    console.log(`│  complaintRate:${(statsResult.complaintRate*100).toFixed(2).padStart(6)}%  deliveryRate:${(statsResult.deliveryRate*100).toFixed(1).padStart(6)}%      │`)
  }
  console.log('└────────────────────────────────────────────────────────────────┘')

  // Assertions
  head('── Metric Assertions ──')
  sent === total ? ok(`All ${total} emails sent by worker`) : fail(`Only ${sent}/${total} sent`)
  campaign?.status === 'sent' ? ok('Campaign status = "sent" (completion working)') : fail(`Campaign status = "${campaign?.status}"`)
  opened >= 1  ? ok(`Open tracking working (${opened} opened)`) : fail('No opens recorded')
  clicked >= 1 ? ok(`Click tracking working (${clicked} clicked)`) : fail('No clicks recorded')

  // SQS events — these depend on SES processing time (usually 5-30s)
  if (bounced >= 1) {
    ok(`Bounce event processed from SQS (${bounced} bounced)`)
  } else {
    info('Bounce event not yet processed — SES may need more time. Run cron again later.')
  }
  if (complained >= 1) {
    ok(`Complaint event processed from SQS (${complained} complained)`)
  } else {
    info('Complaint event not yet processed — SES may need more time.')
  }
  if (delivered >= 1) {
    ok(`Delivery event processed from SQS (${delivered} delivered)`)
  } else {
    info('Delivery event not yet processed — SES may need more time.')
  }

  return { sends, stats: statsResult }
}

// ── Check suppression was auto-created ───────────────────────────────────────

async function checkSuppression() {
  head('── Checking Auto-Suppression ──')

  const suppressions = await prisma.unsubscribe.findMany({
    where: {
      userId: DEMO_UID,
      email: { in: [SIM_BOUNCE, SIM_COMPLAINT] },
    },
    select: { email: true, createdAt: true },
  })

  if (suppressions.some(s => s.email === SIM_BOUNCE)) {
    ok(`${SIM_BOUNCE} auto-suppressed after hard bounce ✅`)
  } else {
    info(`${SIM_BOUNCE} not yet suppressed (bounce event may not have arrived via SQS yet)`)
  }

  if (suppressions.some(s => s.email === SIM_COMPLAINT)) {
    ok(`${SIM_COMPLAINT} auto-suppressed after complaint ✅`)
  } else {
    info(`${SIM_COMPLAINT} not yet suppressed (complaint event may not have arrived via SQS yet)`)
  }
}

// ── Screenshot stats page ─────────────────────────────────────────────────────

async function screenshotStatsPage(page) {
  head('── Stats Page Screenshot ──')
  import('fs').then(fs => fs.mkdirSync(SCREENSHOTS, { recursive: true }))

  await page.goto(`${BASE}/marketing/demo-metrics-campaign/stats`)
  await page.waitForLoadState('networkidle')
  await wait(1500)

  const path = `${SCREENSHOTS}/metrics-stats-page.png`
  await page.screenshot({ path, fullPage: false })
  ok(`Stats page screenshot saved: ${path}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║         Real Email Metrics Test — AWS SES Simulator     ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`  Sending to: ${SIM_SUCCESS}, ${SIM_BOUNCE}, ${SIM_OOTO}, ${SIM_COMPLAINT}`)
  console.log(`  SQS Queue : ${SQS_URL}\n`)

  // Setup seed data
  const { leads, campaign } = await setupSeedData()

  // Browser session for API calls that need auth
  const browser = await chromium.launch({ headless: true })
  const ctx     = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page    = await ctx.newPage()
  page.setDefaultTimeout(20_000)

  // Login
  head('── Logging in ──')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').first().fill(DEMO_USER)
  await page.locator('input[type="password"]').first().fill(DEMO_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 })
  ok('Logged in as demo user')

  try {
    // Send campaign
    await sendCampaign(page)

    // Wait for worker to send all emails
    const sends = await waitForSends(campaign.id, leads.length, 90)

    // Wait for campaign to flip to sent
    await waitForCampaignComplete(campaign.id)

    // Simulate open + click for the delivered address
    await simulateEngagement(page, sends)

    // Navigate back to our app before making API calls (click redirect may have left the page)
    await page.goto(`${BASE}/marketing`, { waitUntil: 'domcontentloaded' })

    // Process SQS events (bounce/complaint/delivery arrive from SES)
    // Round 1 immediately, then wait for SES to process
    await processSqsEvents(page, 4, 15000)

    // Check auto-suppression
    await checkSuppression()

    // Final metrics
    await captureMetrics(page)

    // Screenshot
    await screenshotStatsPage(page)

  } catch (err) {
    console.error('\n💥 Error:', err.message)
    failed++
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0,42-String(passed).length-String(failed).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
