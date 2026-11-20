/**
 * Seeds a test user into the database for E2E tests.
 * Safe to run multiple times — upserts by email.
 *
 * Usage:
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-user.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email    = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) {
    console.error('❌ Set TEST_USER_EMAIL and TEST_USER_PASSWORD')
    process.exit(1)
  }
  const hash     = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where:  { email },
    update: { password: hash, name: 'E2E Test User' },
    create: {
      email,
      password: hash,
      name: 'E2E Test User',
      plan: 'free',
    },
  })

  console.log(`✅ Test user ready — id: ${user.id}  email: ${user.email}`)
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
