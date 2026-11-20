# OutreachAI Demo Test Skill

Test the full OutreachAI demo for user `akhilesh@demo.com`. Covers all 10 product features, seed reset, DB verification, and Excel export.

---

## Credentials

| Item | Value |
|---|---|
| Login | akhilesh@demo.com / password123 |
| Seed secret | `$SEED_SECRET` (from your environment — never commit it) |
| Seed endpoint | `POST https://outreachai.in/api/admin/seed` with header `X-Seed-Secret: $SEED_SECRET` |
| Extension JWT | 30-day token from `POST /api/extension/auth` |

---

## Step 0 — Reset & Reseed

Run this first to wipe the demo user's data and repopulate it fresh:

```bash
curl -s -X POST https://outreachai.in/api/admin/seed \
  -H "X-Seed-Secret: $SEED_SECRET" \
  -H "Content-Type: application/json"
```

Expected: `{"ok":true,"message":"Seed complete — akhilesh@demo.com / password123"}`

---

## Feature Checklist

### 1. Hot-Lead Scoring (`/hot-leads`)

After seeding, these leads must appear with correct scores:

| Lead | Expected Score | Stars |
|---|---|---|
| Rahul Mehta (PhonePe) | 86 | ⭐⭐⭐ |
| Deepika Agarwal (Nykaa) | 54 | ⭐⭐ |
| Arjun Nair (CRED) | 54 | ⭐⭐ |
| Vikram Singh (Razorpay) | 53 | ⭐⭐ |
| Siddharth Bose (Freshworks) | 47 | ⭐⭐ |
| Manish Kumar (Paytm) | 46 | ⭐⭐ |

Verify via DB:
```sql
SELECT "firstName", company, score, "openCount", "clickCount", status
FROM "Lead" l JOIN "LeadList" ll ON ll.id = l."leadListId"
JOIN "User" u ON u.id = ll."userId"
WHERE u.email = 'akhilesh@demo.com' AND score > 0
ORDER BY score DESC;
```

If all scores are 0, run the MCP tool: `recalculateLeadScores()`

---

### 2. Campaigns (`/campaigns`)

3 campaigns must exist:

| Campaign | Status | Leads | Reply Rate |
|---|---|---|---|
| LinkedIn SaaS Outreach - Q1 | active | 20 | 25% |
| EdTech Decision Makers | draft | 5 | — |
| Fintech Founders | paused | 5 | 20% |

Sequence steps in Campaign 1: visit_profile → connection_request → wait_until_accepted → chat_message (day 2) → chat_message (day 7) → chat_message (day 30)

---

### 3. Unified Inbox (`/inbox`)

8 conversations must appear:

| Contact | Channel | Label | Unread |
|---|---|---|---|
| Rahul Mehta | Email | interested | ✓ |
| Vikram Singh | Email | — | ✓ |
| Manish Kumar | LinkedIn | interested | ✓ |
| Siddharth Bose | LinkedIn | favorite | ✓ |
| Kunal Shah | LinkedIn | meeting_booked | — |
| Arjun Nair | Email | — | — |
| Anjali Verma | Email | — | — |
| Deepika Agarwal | LinkedIn | not_interested | — (done) |

---

### 4. Email Warmup (`/warmup`)

2 accounts must appear:

| Account | Day | Target | Ready? |
|---|---|---|---|
| demo@example.com | 12/30 | 15/day | No |
| outreach2@demo.example.com | 6/30 | 8/day | No |

---

### 5. Marketing Broadcasts (`/marketing`)

2 campaigns:

| Name | Status | Open Rate | A/B? |
|---|---|---|---|
| OutreachAI v2 launch | sent | 70% | No |
| Q3 benchmark report | ab_testing | 66.7% | Yes — winner pending |

---

### 6. Deliverability (`/deliverability`)

3 alert rules active: bounce_rate > 5%, open_rate < 15%, reply_rate < 1%
DNS scan runs live — DMARC usually missing on demo domains (expected).

---

### 7. Contact Enrichment (`/settings` → Enrichment API Keys)

Verify API key fields exist for Apollo and Hunter.
Test enrichment search via MCP: `searchAndEnrich({ title: "VP Sales", domain: "phonepe.com" })`

---

### 8. Companies (`/companies`)

10 companies must appear: PhonePe, Razorpay, CRED, Freshworks, Swiggy, Zomato, Zerodha, Groww, Great Learning, upGrad.

Click PhonePe → verify Rahul Mehta is linked + activity timeline shows email events.

---

### 9. Per-Lead Activity Timeline

Click any lead → open side drawer → verify timeline shows events.

Rahul Mehta should have: email.sent → email.opened → email.replied → email.opened (broadcast)

Vikram Singh should have: email.sent → email.opened → email.clicked → task.created → follow-up email sent → opened → LinkedIn reply

---

### 10. Email Sequences + Bounce Handling (`/campaigns/camp_1`)

Rohan Joshi (Swiggy) must show status `bounced` — email `rohan.j@swiggy.example.com` hard-bounced.

---

## Export to Excel

To export all current data to a formatted Excel file with 10 sheets:

```
Ask Claude: "Export the OutreachAI demo data to Excel"
```

Claude will query the DB (via postgres MCP) and generate `OutreachAI_Demo_Data.xlsx` on the Desktop using openpyxl. Sheets: Hot Leads, All Leads, Campaigns, Inbox, Marketing, Warmup, Deliverability, Companies, Activity Timeline, Feature Coverage.

---

## MCP Smoke Test

Run these tools in sequence to verify the MCP agent layer works:

```
1. getDashboardStats()           → should show 28 leads, 3 campaigns, 6+ hot leads
2. getHotLeads(limit=5)          → Rahul, Deepika, Arjun, Vikram, Siddharth
3. getNotifications()            → overdue steps + unread threads
4. getWarmupStatus()             → 2 accounts, day 12 and day 6
5. getDeliverabilityReport()     → SPF/DMARC check on demo domains
6. getMarketingStats()           → 2 campaigns, one in ab_testing
7. getCompanyOverview(co_phonepe)→ PhonePe with Rahul linked
8. recalculateLeadScores()       → should return updated: 10
```

---

## Common Failures & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| Seed returns 500 with FK error | companyId in activity references missing Company | Check `moreActs` in seed.ts for `co_paytm` references — should be removed |
| All lead scores = 0 | Seed ran before scoring formula was deployed | Run `recalculateLeadScores()` MCP tool |
| Inbox shows 0 conversations | Seed didn't run or ran against wrong DB | Re-run seed, verify DATABASE_URL on Vercel points to Neon |
| CORS errors from extension | Extension calling route not in middleware matcher | Add route to `webapp/middleware.ts` EXTENSION_ROUTES set |
| AI Personalize returns "key not configured" | No Anthropic key in Settings | Go to outreachai.in/settings → AI Providers → add key |
| Hot Leads page empty | score = 0 on all leads | Run `recalculateLeadScores()` |

---

## Files

| File | Purpose |
|---|---|
| `webapp/prisma/seed.ts` | Full demo seed (852+ lines) — exports `seedDemo()` |
| `webapp/app/api/admin/seed/route.ts` | POST endpoint that calls `seedDemo()` against production DB |
| `webapp/lib/leadScore.ts` | Hot-lead scoring formula (opens×7 + clicks×25 + reply×40) |
| `webapp/middleware.ts` | CORS for all extension-called API routes |
| `webapp/lib/mcp/SYSTEM_PROMPT.md` | MCP agent system prompt with all 10 tool chains |
| `webapp/lib/mcp/tools/intelligence.ts` | 10 read-only MCP tools |
| `webapp/lib/mcp/tools/execution.ts` | 9 write MCP tools |
