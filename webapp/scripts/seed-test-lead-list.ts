/**
 * Seeds a lead list with one test lead for the E2E test user.
 * Usage:
 *   DATABASE_URL=... npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-lead-list.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const TEST_EMAIL = 'outreachai.in@gmail.com'

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!user) {
    console.error(`❌ Test user ${TEST_EMAIL} not found — run seed-test-user.ts first`)
    process.exit(1)
  }

  const list = await prisma.leadList.upsert({
    where:  { id: 'e2e-test-lead-list' },
    update: { name: 'E2E Test List' },
    create: { id: 'e2e-test-lead-list', userId: user.id, name: 'E2E Test List' },
  })

  await prisma.lead.upsert({
    where:  { id: 'e2e-test-lead' },
    update: { firstName: 'E2E', lastName: 'Tester', email: 'outreachai.in@gmail.com' },
    create: {
      id:          'e2e-test-lead',
      leadListId:  list.id,
      firstName:   'E2E',
      lastName:    'Tester',
      email:       'outreachai.in@gmail.com',
      company:     'OutreachAI',
    },
  })

  console.log(`✅ Lead list ready — id: ${list.id}  name: "${list.name}" (1 lead)`)
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
