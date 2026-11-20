/**
 * Re-encrypts every value produced by lib/encryption.ts with a new ENCRYPTION_KEY.
 *
 * It scans every text column in the public schema for values shaped like
 * `<24 hex iv>:<32 hex tag>:<hex ciphertext>`, decrypts them with the OLD key and
 * re-encrypts them with the NEW key. Values that do not decrypt with the old key
 * are left untouched and reported.
 *
 * Usage (dry run first, then --apply):
 *   DATABASE_URL=... OLD_ENCRYPTION_KEY=... NEW_ENCRYPTION_KEY=... \
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/rotate-encryption-key.ts
 *   ... scripts/rotate-encryption-key.ts --apply
 *
 * After --apply succeeds, set ENCRYPTION_KEY=<NEW_ENCRYPTION_KEY> in Vercel and redeploy.
 * Take a database backup (Neon branch) before running with --apply.
 */
import { PrismaClient } from '@prisma/client'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const OLD = process.env.OLD_ENCRYPTION_KEY
const NEW = process.env.NEW_ENCRYPTION_KEY
const APPLY = process.argv.includes('--apply')

if (!OLD || !NEW) {
  console.error('❌ Set OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY')
  process.exit(1)
}
if (OLD === NEW) {
  console.error('❌ OLD and NEW keys are identical')
  process.exit(1)
}

// Must match lib/encryption.ts getKey()
const toKey = (raw: string) => Buffer.from(raw.padEnd(32, '0').slice(0, 32), 'utf8')
const oldKey = toKey(OLD)
const newKey = toKey(NEW)

const PATTERN = '^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$'

function decrypt(value: string, key: Buffer): string {
  const [ivHex, tagHex, encHex] = value.split(':')
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  d.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([d.update(Buffer.from(encHex, 'hex')), d.final()]).toString('utf8')
}

function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc.toString('hex')}`
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`

const prisma = new PrismaClient()

async function main() {
  const columns = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
      AND c.table_name <> '_prisma_migrations'
  `)

  const pkCols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
  `)
  const pkByTable = new Map<string, string[]>()
  for (const r of pkCols) pkByTable.set(r.table_name, [...(pkByTable.get(r.table_name) ?? []), r.column_name])

  let rotated = 0
  let failed = 0

  for (const { table_name, column_name } of columns) {
    const pks = pkByTable.get(table_name)
    if (!pks || pks.length !== 1) continue // encrypted columns all live on single-id tables
    const pk = pks[0]

    const rows = await prisma.$queryRawUnsafe<{ id: string; value: string }[]>(
      `SELECT ${q(pk)}::text AS id, ${q(column_name)} AS value FROM ${q(table_name)} WHERE ${q(column_name)} ~ $1`,
      PATTERN,
    )
    if (rows.length === 0) continue

    let ok = 0
    for (const row of rows) {
      let plain: string
      try {
        plain = decrypt(row.value, oldKey)
      } catch {
        failed++
        console.warn(`  ⚠️  ${table_name}.${column_name} id=${row.id}: does not decrypt with OLD key — skipped`)
        continue
      }
      const next = encrypt(plain, newKey)
      if (decrypt(next, newKey) !== plain) throw new Error('Round-trip check failed')
      if (APPLY) {
        await prisma.$executeRawUnsafe(
          `UPDATE ${q(table_name)} SET ${q(column_name)} = $1 WHERE ${q(pk)}::text = $2 AND ${q(column_name)} = $3`,
          next, row.id, row.value,
        )
      }
      ok++
    }
    rotated += ok
    console.log(`${APPLY ? '✅' : '🔎'} ${table_name}.${column_name}: ${ok}/${rows.length} value(s) ${APPLY ? 're-encrypted' : 'would be re-encrypted'}`)
  }

  console.log(`\n${APPLY ? 'Re-encrypted' : 'Dry run — would re-encrypt'} ${rotated} value(s); ${failed} skipped.`)
  if (!APPLY) console.log('Run again with --apply to write changes.')
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
