# /test-features — Full feature test suite for OutreachAI

Run this skill to verify every major feature is working correctly. It runs in sequence: schema validation → unit tests → build → API smoke tests against the live dev server.

---

## What this tests

| # | Feature | Tests |
|---|---|---|
| 1 | Schema | All models present, prisma generate clean |
| 2 | TypeScript | Zero type errors across all routes and pages |
| 3 | Unit tests | All 78 smoke tests pass (vitest) |
| 4 | Production build | Next.js compiles all 96 pages cleanly |
| 5 | Marketing mailer | Create, send, track open/click, unsubscribe |
| 6 | Email warmup | Enroll, run cycle, pause/resume |
| 7 | Lead enrichment | Apollo → Hunter waterfall, verify email |
| 8 | A/B testing | Split send, resolve winner |
| 9 | Team workspaces | Create, invite, switch, roles |
| 10 | Onboarding | Step completion detection |

---

## Steps to execute

### Step 1 — Schema & Prisma

```bash
cd webapp
npx prisma validate
npx prisma generate
```

Expected: `Prisma schema validated successfully` and `Generated Prisma Client`.

Check all required models exist:
```bash
grep "^model " prisma/schema.prisma
```

Required models: `User`, `EmailAccount`, `MarketingCampaign`, `MarketingCampaignSend`, `Unsubscribe`, `WarmupAccount`, `WarmupEmail`, `Workspace`, `WorkspaceMember`, `WorkspaceInvite`, `Lead`, `LeadList`, `Campaign`, `CampaignLead`, `Sequence`, `Template`.

Required User fields: `apolloApiKey`, `hunterApiKey`, `onboardingCompleted`, `onboardingStep`, `workspaceId`.

Required MarketingCampaign fields: `abEnabled`, `abSubjectB`, `abSplitPercent`, `abWinnerMetric`, `abTestDurationHours`, `abWinner`.

---

### Step 2 — TypeScript

```bash
cd webapp
npx tsc --noEmit
```

Expected: `TypeScript: No errors found`. Fix any errors before proceeding.

---

### Step 3 — Unit tests

```bash
cd webapp
npm test
```

Expected: `9 test files passed`, `78 tests passed`, zero failures.

If any test fails, read the failure output carefully. Common causes:
- Missing mock in `tests/smoke/setup.ts` → add the missing Prisma model mock
- Route changed but test not updated → update the test to match new response shape
- Import path wrong → check the route file actually exists

---

### Step 4 — Production build

```bash
cd webapp
npm run build
```

Expected: `✓ Compiled successfully`, `✓ Generating static pages (96/96)`.

If build fails with a TypeScript error: run Step 2 first and fix all errors.
If build fails with a missing module: check the import path in the failing file.

---

### Step 5 — Start dev server

```bash
cd webapp
npm run dev &
sleep 5
```

Wait for `ready started server on 0.0.0.0:3000`.

---

### Step 6 — API smoke tests (curl)

Run each of the following. A `401` response proves the route exists and auth is wired. Any other error (404, 500) indicates a broken route.

**Auth guard checks (expect 401):**
```bash
BASE=http://localhost:3000/api

curl -s -o /dev/null -w "%{http_code}" $BASE/marketing/campaigns         # 401
curl -s -o /dev/null -w "%{http_code}" $BASE/warmup                       # 401
curl -s -o /dev/null -w "%{http_code}" $BASE/enrichment/search -X POST -H "Content-Type: application/json" -d '{}' # 401
curl -s -o /dev/null -w "%{http_code}" $BASE/workspaces                   # 401
curl -s -o /dev/null -w "%{http_code}" $BASE/onboarding                   # 401
curl -s -o /dev/null -w "%{http_code}" $BASE/marketing/campaigns/x/stats  # 401
curl -s -o /dev/null -w "%{http_code}" $BASE/marketing/campaigns/x/ab-resolve -X POST # 401
```

**Tracking endpoints (public — expect 200 or 302):**
```bash
curl -s -o /dev/null -w "%{http_code}" "$BASE/marketing/track/open?sid=nonexistent"   # 200 (returns pixel)
curl -s -o /dev/null -w "%{http_code}" "$BASE/marketing/track/click?sid=x&url=https://example.com" # 302
curl -s -o /dev/null -w "%{http_code}" "$BASE/marketing/unsubscribe?sid=nonexistent"  # 200 (shows page)
```

**Pages (expect 200):**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/marketing    # 200 (redirects to login) or 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/warmup       # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/enrichment   # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/share        # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/join         # 200
```

---

### Step 7 — Feature-by-feature checklist

Work through each feature manually in the browser at `http://localhost:3000`. Log in first.

#### Marketing Mailer
- [ ] `/marketing` loads with empty state or campaign list
- [ ] `/marketing/new` form has: name, subject, from name, email account dropdown, lead list dropdown
- [ ] Create a campaign → redirects to `/marketing/[id]/edit`
- [ ] HTML editor: type `<h1>Hello {{firstName}}</h1>` → live preview updates in iframe
- [ ] Save Draft works (no page error)
- [ ] "Send Now" button shows confirmation dialog before sending
- [ ] `/marketing/[id]/stats` shows sent/opened/clicked/unsubscribed counts
- [ ] Open tracking: `/api/marketing/track/open?sid=REAL_SID` returns a 1px GIF
- [ ] Click tracking: `/api/marketing/track/click?sid=REAL_SID&url=https://example.com` redirects

#### A/B Testing
- [ ] In campaign editor, toggle "Enable A/B Test" shows Subject B input + split % + duration fields
- [ ] Send with A/B enabled → campaign status becomes `ab_testing`
- [ ] `/marketing/[id]/stats` shows A/B panel with variant A/B bars
- [ ] "Resolve Winner Now" button appears when status is `ab_testing`

#### Email Warmup
- [ ] `/warmup` loads with empty state or account list
- [ ] "Add Account to Warmup" form shows email account selector + daily target slider
- [ ] Enroll an account → card appears with progress bar at day 0
- [ ] "Run Now" button calls `/api/warmup/[id]/run` and shows result
- [ ] Pause toggle changes badge from green to yellow

#### Lead Enrichment
- [ ] `/enrichment` loads with search form
- [ ] Provider badge shows "Auto (Apollo → Hunter fallback)"
- [ ] Search with no keys configured → shows setup message with link to Settings
- [ ] Settings → Enrichment API Keys section shows Apollo + Hunter inputs

#### Team Workspaces
- [ ] Settings → Team page loads
- [ ] Create workspace form shows name input
- [ ] After creating: workspace name shown, member table has creator as Admin
- [ ] Invite form: email + role select + Send Invite → shows invite link
- [ ] TopBar shows workspace name (or "Personal") with dropdown
- [ ] `/join?token=INVALID` → shows "invitation not found" or 404

#### Onboarding
- [ ] Dashboard shows onboarding checklist on first login (if steps incomplete)
- [ ] Each step has correct "Go →" link
- [ ] Progress bar reflects actual step count
- [ ] When all 5 steps done → shows "You're all set! Help spread the word →" link to `/share`

#### Share page
- [ ] `/share` loads with GitHub star button, PH vote button, Twitter/LinkedIn share buttons
- [ ] "Copy link" button copies to clipboard and shows "Copied!" feedback

---

### Step 8 — Playwright critical-path tests

```bash
cd webapp
npx playwright test tests/e2e/critical-path.spec.ts --reporter=list
```

Set env vars for authenticated tests:
```bash
TEST_USER_EMAIL=your@email.com TEST_USER_PASSWORD=yourpassword npx playwright test tests/e2e/critical-path.spec.ts
```

Expected: 3 tests, tracking/unsubscribe tests always pass, login test passes if credentials are correct.

---

### Step 9 — Schema migration reminder

If running against a fresh database, migration is required:

```bash
cd webapp
npx prisma migrate deploy
```

Or for local dev:
```bash
npx prisma db push
```

Required tables that must exist: `marketing_campaigns`, `marketing_campaign_sends`, `unsubscribes`, `warmup_accounts`, `warmup_emails`, `workspaces`, `workspace_members`, `workspace_invites`.

---

### Step 10 — Docker build (optional, for self-hosted verification)

```bash
cd /path/to/lemlist-10x
docker compose build
docker compose up -d
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000   # expect 200
docker compose down
```

---

## Pass criteria

| Check | Pass |
|---|---|
| `prisma validate` | Clean |
| `tsc --noEmit` | 0 errors |
| `npm test` | 78/78 |
| `npm run build` | Compiled, 96 pages |
| All 7 auth-guard curls | All `401` |
| Tracking pixel curl | `200` |
| Click redirect curl | `302` |
| Manual checklist | All boxes ticked |

If everything passes: the build is shippable. Run `git push origin main` and the Vercel deployment will kick off automatically.

---

## Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `prisma.warmupAccount is undefined` in tests | Missing mock in setup.ts | Add model to prisma mock in `tests/smoke/setup.ts` |
| Build fails: `apolloApiKey does not exist on User` | schema.prisma missing fields | Re-run `npx prisma generate` after checking schema has the field |
| `/api/marketing/campaigns` returns 500 | DB not migrated | Run `npx prisma db push` |
| Tracking pixel returns 500 | `NEXT_PUBLIC_APP_URL` not set | Add to `.env.local` |
| Warmup pool error "not enough accounts" | Only 1 warmup account in system | Enroll a second email account |
| A/B resolve sends duplicates | Race condition | Fixed in campaign/[id]/route.ts with atomic updateMany check |
