# OutreachAI — Claude Code Guidelines

## Stack
Next.js 15 · Tailwind 4 · Prisma/Neon (PostgreSQL) · NextAuth · Vercel

---

## Feature Completeness Rule (MOST IMPORTANT)

**A feature is NOT done until all three layers exist and are verified:**

| Layer | What to check |
|-------|--------------|
| **DB** | Prisma schema has the model/column. Migration file exists in `prisma/migrations/`. |
| **API** | Route under `webapp/app/api/` exists, is auth-gated, and returns correct data. |
| **UI** | User can actually see and interact with the feature in the browser. |

Missing any one layer = broken feature. The enrichment API keys bug (API + migration existed, Settings UI was absent) is the canonical example of why this matters.

### Checklist for every new feature

Before marking anything as done, answer YES to all of these:

- [ ] DB: Is there a migration for every new table or column?
- [ ] API: Does the route exist and handle GET/POST/DELETE as needed?
- [ ] UI: Is there a visible, clickable UI element for the user?
- [ ] Settings: If it's a user-configurable key/toggle/account, is it in `webapp/app/settings/page.tsx`?
- [ ] End-to-end: Did you open the browser (or run a Playwright test) and confirm the full flow works?
- [ ] Error states: What does the user see if the API call fails?

---

## Settings Page Contract

`webapp/app/settings/page.tsx` is the single source of truth for user configuration.

**Rule: every `webapp/app/api/settings/*` route MUST have a matching UI section in `settings/page.tsx`.**

Current sections and their API routes:

| UI Section | API Route |
|------------|-----------|
| AI Providers | `/api/settings/ai-keys` |
| Enrichment API Keys | `/api/settings/enrichment-keys` |
| Profile | `/api/settings/profile` |
| Webhooks | `/api/webhooks` |

When adding a new settings API route, add the Settings UI in the same commit.

---

## Database Migrations

### How migrations deploy
`scripts/migrate-prod.ts` runs at the start of every Vercel build. It applies each
migration idempotently (silently skips "already exists" PG errors) and records it
in `_prisma_migrations`. `prisma migrate deploy` runs after as a consistency check.

### Rules
- Every schema change needs a migration file: run `npm run db:migrate` locally first.
- Never use `prisma db push` in production — it bypasses migration history.
- After adding a migration, verify it appears in `prisma/migrations/` before deploying.
- New migration + API route + UI must ship in the same deploy. Never ship a migration
  without the UI that uses it.

---

## Testing Requirements

### Before every deploy
```bash
npm test              # 78 unit tests must pass
npm run test:e2e      # Playwright critical-path tests
```

### For new features, also run
```bash
npm run test:critical:prod   # smoke-test against production after deploy
```

### What "tested" means
- **Backend**: API route returns correct data for authenticated user; returns 401 for unauthenticated.
- **Frontend**: Open the page in a browser (or Playwright). Confirm the UI renders, the
  happy path works, and errors are handled gracefully (no blank screens, no silent 500s).
- **Settings features**: Literally open `/settings`, confirm the section is visible,
  fill in a value, save it, reload — confirm the masked/saved value persists.

### Never claim a feature works based solely on
- TypeScript compiling without errors
- `next build` succeeding
- A 200 from the API in isolation

---

## Common Bugs to Avoid

### 1. Backend-only features
Symptom: API route + migration exists but user can't see it anywhere.
Prevention: Search for the feature name in `settings/page.tsx` before closing the task.

### 2. Migration not applied in production
Symptom: 500 errors on API routes that query new tables.
Prevention: `scripts/migrate-prod.ts` handles this automatically. Verify the migration
file exists in `prisma/migrations/` before deploying.

### 3. Partial migrations
Symptom: Some columns in a migration already exist (from a previous `db push`), causing
`migrate deploy` to fail on the whole migration.
Prevention: `migrate-prod.ts` applies statement-by-statement and skips existing objects.
Never mix "already applied" and "new" in the same migration — create a new migration file.

### 4. Buttons that render but do nothing
Symptom: A button is visible in the UI but has no `onClick` — clicking it silently fails.
Prevention: Search for every `<button` in new or changed components and verify each has
an `onClick` that calls a real function. Pay special attention to action buttons added
as visual placeholders ("FIND PHONE", "Enrich leads", etc.).

### 5. API key / secret stored but never surfaced
Symptom: User saves a key but there's no confirmation it was saved (no masked display
on reload). Prevention: GET handler must return masked value; UI must show it on load.

---

## Project Structure Quick Reference

```
webapp/
  app/
    api/              ← API routes (always auth-gated via auth())
      settings/       ← user config (ai-keys, enrichment-keys, profile)
      webhooks/       ← webhook CRUD + test
    settings/
      page.tsx        ← ALL user-configurable settings live here
  prisma/
    schema.prisma     ← source of truth for DB shape
    migrations/       ← never edit manually; use prisma migrate dev
  scripts/
    migrate-prod.ts   ← idempotent migration runner (called in build)
```

---

## Deploy Checklist

1. `npm test` — all pass
2. `npm run build` — clean build locally
3. Check: does any new API route need a UI? Does any new DB column need a migration?
4. `npm run deploy` — Vercel production deploy
5. Open the relevant page in the browser and verify the feature works end-to-end

---

## UI / Styling Rules

### Color system
- Brand blue is `#0A66C2` (hover `#0855a5`). In Tailwind these are mapped to `bg-blue-600` / `bg-blue-700` via `@theme inline` in `globals.css` — never hardcode the hex in className strings.
- CSS variables live in `globals.css` `:root`. `@theme inline` maps them to Tailwind utilities. If you add a new token, remove any redundant older token that did the same job.

### Status badges — one pattern only
All status/state badges across the app use this exact structure:
```
bg-{color}-50 text-{color}-700 border border-{color}-200
dark:bg-{color}-900/30 dark:text-{color}-400 dark:border-{color}-800/50
```
Use the shared `Badge` component (`webapp/components/ui/Badge.tsx`) where possible. Never use opaque `dark:bg-{color}-950` for status indicators — that was the old inconsistent pattern.

### Shared UI components
Before writing inline className chains for buttons, inputs, cards, or badges, check `webapp/components/ui/` first:
- `Button` — primary / secondary / ghost / danger variants
- `Badge` — blue / green / red / yellow / gray / purple / amber / rose
- `Card`, `CardHeader`, `CardBody`
- `Input`, `Textarea`, `Select`
- `PageHeader`

### `cn()` utility
`webapp/lib/cn.ts` uses `tailwind-merge`. Always use `cn()` when composing className strings so conflicting Tailwind classes are deduplicated correctly.

---

## Search Rules (lessons from missed fixes)

When hunting for a pattern (hardcoded color, old class name, etc.) across the codebase:

1. **Search all `.tsx` files, not just `page.tsx`** — many pages split logic into sibling `components.tsx`, `hooks.ts`, or named component files. A `--include="page.tsx"` grep will miss them.
   ```bash
   # Wrong — misses components.tsx, hooks.ts, shared files
   grep -r "pattern" --include="page.tsx"
   # Right
   grep -r "pattern" --include="*.tsx" --include="*.ts"
   ```

2. **When changing a color class, also check the CSS variable it reads** — fixing `focus:ring-blue-500` → `focus:ring-blue-600` in classNames doesn't fix `--tw-ring-color` in the `.dark {}` block of `globals.css`. Trace tokens end-to-end.

3. **When a page file is large, check for a sibling `components.tsx`** — e.g. `app/schedule/page.tsx` imports from `./components`. Always check that companion file for the same patterns you're fixing in the page.
