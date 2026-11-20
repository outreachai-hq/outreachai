/**
 * Idempotent migration deploy for databases bootstrapped with `prisma db push`.
 *
 * Problem: `prisma db push` creates all tables but leaves no _prisma_migrations
 * history. `prisma migrate deploy` then chokes on "relation already exists" errors,
 * and mixed migrations (some statements already applied, some not) can't be retried.
 *
 * Solution: apply every unrecorded migration ourselves, statement by statement,
 * silently skipping statements that fail with "already exists" PG codes. Once a
 * migration is fully processed we insert it into _prisma_migrations, so the
 * final `prisma migrate deploy` call becomes a no-op (just a consistency check).
 *
 * Also fixes any "failed" migration rows left by a previous botched deploy attempt.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PG error codes that mean "this object already exists — skip it"
const ALREADY_EXISTS_CODES = new Set([
  '42P07', // relation already exists
  '42701', // column already exists
  '42P16', // invalid table definition (duplicate constraint name)
  '42710', // duplicate object (index/constraint)
  '23505', // unique violation (from re-adding unique constraint)
])

function sha256hex(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function splitStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')   // strip line comments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

async function applyIdempotently(sql: string): Promise<void> {
  for (const stmt of splitStatements(sql)) {
    try {
      await prisma.$executeRawUnsafe(stmt)
    } catch (err: any) {
      // Prisma wraps PG errors: client code is 'P2010', actual PG code is in meta.code
      const pgCode: string | undefined = err?.meta?.code
      if (pgCode && ALREADY_EXISTS_CODES.has(pgCode)) continue
      throw err
    }
  }
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `
  return rows[0]?.exists ?? false
}

async function ensureMigrationsTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  VARCHAR(36)  NOT NULL,
      "checksum"            VARCHAR(64)  NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INT          NOT NULL DEFAULT 0,
      PRIMARY KEY ("id")
    )
  `)
}

async function recordApplied(name: string, sql: string): Promise<void> {
  const id = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
    VALUES
      (${id}, ${sha256hex(sql)}, now(), ${name}, NULL, now(), 1)
  `
}

async function resolveFailed(name: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "_prisma_migrations"
    SET finished_at = now(), applied_steps_count = 1, logs = NULL
    WHERE migration_name = ${name}
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
  `
}

async function main() {
  console.log('[migrate-prod] starting', new Date().toISOString())
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
  console.log('[migrate-prod] migrationsDir:', migrationsDir)

  const allMigrations = fs.readdirSync(migrationsDir)
    .filter(d => {
      const p = path.join(migrationsDir, d)
      return d !== 'migration_lock.toml' && fs.statSync(p).isDirectory()
    })
    .sort()

  console.log('[migrate-prod] found migrations:', allMigrations.length)

  console.log('[migrate-prod] connecting to DB...')
  await ensureMigrationsTable()
  console.log('[migrate-prod] DB connected, migrations table ready')

  type MigRow = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }
  const recorded = await prisma.$queryRaw<MigRow[]>`
    SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
  `
  console.log('[migrate-prod] recorded migrations:', recorded.length)

  const appliedNames = new Set(
    recorded.filter(r => r.finished_at !== null).map(r => r.migration_name)
  )
  const failedNames = new Set(
    recorded
      .filter(r => r.finished_at === null && r.rolled_back_at === null)
      .map(r => r.migration_name)
  )

  console.log('[migrate-prod] applied:', appliedNames.size, '| failed:', failedNames.size)

  for (const name of allMigrations) {
    const sqlPath = path.join(migrationsDir, name, 'migration.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    if (failedNames.has(name)) {
      console.log(`  fixing failed:  ${name}`)
      await applyIdempotently(sql)
      await resolveFailed(name)
      console.log(`  fixed:          ${name}`)
      continue
    }

    if (appliedNames.has(name)) {
      console.log(`  already applied: ${name}`)
      continue
    }

    console.log(`  applying:       ${name}`)
    await applyIdempotently(sql)
    await recordApplied(name, sql)
    console.log(`  done:           ${name}`)
  }

  await prisma.$disconnect()
  console.log('[migrate-prod] done', new Date().toISOString())
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
