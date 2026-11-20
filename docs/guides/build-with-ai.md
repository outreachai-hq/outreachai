# How I Built OutReachAI.in from Scratch Using Claude Code

> A complete step-by-step guide for the session:  
> **"Building with AI — from idea to working app"**

---

## What We Built

**OutReachAI.in** — a LinkedIn outreach automation SaaS with:
- Next.js 15 webapp (React, TypeScript, Tailwind)
- PostgreSQL database (Neon — free cloud DB)
- Google OAuth + email/password auth
- Chrome extension for LinkedIn
- AI-personalized outreach messages
- Email campaigns with reply tracking
- Dark mode, full dashboard, analytics
- Auto-deployed to Vercel on every git push

**Time taken:** A few hours with Claude Code  
**Cost:** $0 (all free tiers)  
**Lines of code written manually:** ~0

---

## Tools Used

| Tool | Purpose | Cost |
|------|---------|------|
| Claude Code | AI coding assistant (CLI) | Paid |
| GitHub | Source code, CI/CD | Free |
| Vercel | App hosting | Free |
| Neon | PostgreSQL database | Free |
| Resend | Transactional email | Free (3k/month) |
| Google Cloud | OAuth login | Free |
| GoDaddy | Domain (outreachai.in) | Paid |
| Chrome Web Store | Extension publishing | $5 one-time |

---

## Step 1 — Start With an Idea, Not Code

Before touching a keyboard, describe your app clearly:

> "I want to build a LinkedIn outreach tool. Users sign up, import leads from LinkedIn via a Chrome extension, set up email sequences, and track replies. AI generates personalized openers for each lead."

**The AI prompt approach:**
- Describe WHAT, not HOW
- Be specific about features
- Mention the tech stack you want (or let Claude choose)
- Ask for a full plan before any code

---

## Step 2 — GitHub Setup

```bash
# Create repo on github.com, then:
git clone https://github.com/your-org/your-repo.git
cd your-repo

# Create feature branch (never code on main)
git checkout -b feat/initial-build
```

**Best practice:** Always work on a feature branch. Merge to main only when it works.

---

## Step 3 — Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Claude Code is a CLI that:
- Reads and writes files in your project
- Runs terminal commands
- Understands your entire codebase
- Remembers context across the session

---

## Step 4 — Scaffold the App with One Prompt

Tell Claude exactly what to build:

```
Build a Next.js 15 app with:
- App Router, TypeScript, Tailwind CSS
- Prisma ORM with PostgreSQL
- NextAuth.js for authentication
- A sidebar layout with: Dashboard, Campaigns, 
  Leads, Contacts, Sequences, Templates, Email, Inbox, Settings
- Dark mode support
- Docker Compose for local Postgres
```

Claude will:
1. Create the full project structure
2. Write all config files
3. Set up the database schema
4. Build the layout and navigation
5. Wire everything together

---

## Step 5 — Build Feature by Feature

Don't ask Claude to build everything at once. Go feature by feature:

```
# Example prompts used in this project:

"Add Google OAuth login alongside email/password auth"

"Build a leads page where users can create lead lists 
 and import contacts via CSV"

"Add a Chrome extension that reads LinkedIn profiles 
 and syncs contacts to the dashboard"

"Add AI-powered opener generation using Claude API 
 for each lead"

"Build an email campaign system with SMTP support 
 and reply detection via IMAP"
```

**Key insight:** Each prompt builds on the previous. Claude remembers the full context.

---

## Step 6 — Fix Bugs Instantly

When something breaks, just describe it:

```
"The CSV import is broken — it's failing on files 
 with UTF-8 BOM characters and the regex is unterminated"

"Dark mode isn't working on the dashboard — 
 all cards have hardcoded bg-white without dark variants"

"The Vercel build is failing with: 
 'msg.envelope is possibly undefined' at line 47"
```

Claude reads the error, finds the file, and fixes it.

---

## Step 7 — Free Database with Neon

```bash
# 1. Sign up at neon.com
# 2. Create project, copy connection string
# 3. Add to .env.local:
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# 4. Run migrations:
export $(grep -v '^#' .env.local | xargs)
npx prisma migrate deploy
```

Neon gives you a **free serverless PostgreSQL** — perfect for MVPs.

---

## Step 8 — Free Email with Resend

```bash
# 1. Sign up at resend.com
# 2. Get API key
# 3. Add to .env.local:
RESEND_API_KEY=re_xxxxxxxxxxxx

# 4. In code:
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'App <noreply@yourdomain.com>',
  to: user.email,
  subject: 'Reset your password',
  html: '<p>Click here to reset...</p>'
})
```

Free tier: **3,000 emails/month**.

---

## Step 9 — Deploy Free on Vercel

```bash
# Install CLI
npm install -g vercel

# Login
vercel login

# Add environment variables
echo "your-db-url" | vercel env add DATABASE_URL production --yes
echo "your-resend-key" | vercel env add RESEND_API_KEY production --yes
# ... add all env vars

# Deploy
vercel --prod
```

Your app is live at `https://your-app.vercel.app`.

---

## Step 10 — Custom Domain via GoDaddy API

Instead of clicking through dashboards, do it in 30 seconds:

```bash
GD_KEY="your-godaddy-api-key"
GD_SECRET="your-godaddy-secret"
DOMAIN="yourdomain.com"

# Point domain to Vercel
curl -X PUT "https://api.godaddy.com/v1/domains/$DOMAIN/records/A/@" \
  -H "Authorization: sso-key $GD_KEY:$GD_SECRET" \
  -H "Content-Type: application/json" \
  -d '[{"data":"76.76.21.21","ttl":600}]'
```

Get GoDaddy API keys at: **developer.godaddy.com/keys**

---

## Step 11 — Auto-Deploy with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g vercel
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

Add secrets to GitHub:
```bash
gh secret set VERCEL_TOKEN --body "your-token"
gh secret set VERCEL_PROJECT_ID --body "prj_xxx"
gh secret set VERCEL_ORG_ID --body "team_xxx"
```

Now every `git push origin main` auto-deploys. ✅

---

## Step 12 — Chrome Extension

The extension lives in `/extension` folder:

```
extension/
  manifest.json    ← permissions, version, icons
  content.js       ← runs on linkedin.com pages
  popup.html       ← extension popup UI
  popup.js         ← popup logic
  background.js    ← service worker
  icons/           ← 16px, 48px, 128px icons
```

**Publish to Chrome Web Store via API:**

```bash
# 1. Get OAuth token (one-time)
node cws-auth.mjs

# 2. Upload + publish
node cws-publish.mjs
```

---

## Step 13 — Generate Store Assets with Code

Instead of designing screenshots manually, generate them:

```bash
# Headless Chrome renders HTML → PNG
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" --headless=new \
  --screenshot=screenshot1.png \
  --window-size=1280,800 \
  "file://$(pwd)/screenshot-mockup.html"
```

Write HTML mockups, screenshot them. No Figma needed.

---

## The AI Workflow That Actually Works

```
1. DESCRIBE  → Tell Claude what to build (be specific)
2. REVIEW    → Read what it wrote (don't blindly trust)
3. TEST      → Run the app, click around
4. FIX       → Paste errors back to Claude
5. ITERATE   → Build the next feature
6. COMMIT    → git add, commit, push
7. REPEAT
```

---

## Key Lessons

**1. Context is everything**
Claude Code reads your whole codebase. The more files it can see, the smarter its suggestions.

**2. Be the architect, not the coder**
You decide WHAT to build. Claude decides HOW. Review its decisions.

**3. One feature at a time**
Don't ask for 10 things at once. Small, focused prompts = better code.

**4. Always read the diff**
Before committing, review what changed. `git diff` is your friend.

**5. Automate everything**
DNS, deployments, asset generation, publishing — if you do it twice, script it.

**6. Free tier stack is powerful**
Vercel + Neon + Resend + Google OAuth = production-ready SaaS at $0/month.

---

## The Complete Free Stack

```
Frontend:   Next.js 15 (React, TypeScript, Tailwind)
Database:   Neon PostgreSQL (free tier)
Auth:       NextAuth.js + Google OAuth
Email:      Resend (3k/month free)
Hosting:    Vercel (free tier)
CI/CD:      GitHub Actions (free)
Domain:     GoDaddy (~$10/year)
Extension:  Chrome Web Store ($5 one-time)
AI coding:  Claude Code
```

**Total recurring cost: $0/month** (until you scale)

---

## Resources

| Resource | URL |
|----------|-----|
| Claude Code | claude.ai/code |
| This project | github.com/outreachai-hq/outreachai |
| Live app | outreachai.in |
| Neon (free DB) | neon.com |
| Resend (free email) | resend.com |
| Vercel (free hosting) | vercel.com |
| GoDaddy API docs | developer.godaddy.com |
| Chrome Web Store | chrome.google.com/webstore/devconsole |

---

## What to Build Live in the Session

**Suggestion: Build a "Link in Bio" tool**

- User signs up → gets a page at `yourdomain.com/username`
- Adds links (Twitter, GitHub, portfolio, etc.)
- Customizes colors and bio
- Tracks click analytics

**Why this works for a live demo:**
- Simple enough to build in 30–45 min with Claude
- Shows auth, database, dynamic pages, deployment
- Everyone in the audience understands it immediately
- Has a visible, shareable result

---

*Built entirely with Claude Code — zero manual coding.*  
*Questions? outreachai.in@gmail.com*
