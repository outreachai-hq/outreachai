# Chrome Extension Release Guide

Complete step-by-step guide to build and publish the LinkedIn Outreach Assistant extension.

Extension ID: `pldbpdkhdneapgdonahhallmjbodeejg`
Publisher: `outreachai.in@gmail.com`
Chrome Web Store: https://chromewebstore.google.com/detail/pldbpdkhdneapgdonahhallmjbodeejg

---

## Step 1 — Update Production URLs

Before packaging, ensure all URLs point to production (not localhost).

**`extension/popup.js` line 1:**
```js
const API_BASE = 'https://outreachai.in'
```

**`extension/popup.html`:**
```html
<a href="https://outreachai.in/signup">Create account →</a>
<a href="https://outreachai.in/settings">Upgrade →</a>
```

**`extension/manifest.json` host_permissions:**
```json
"host_permissions": [
  "https://www.linkedin.com/*",
  "https://api.anthropic.com/*",
  "https://api.openai.com/*",
  "https://outreachai.in/*"
]
```

---

## Step 2 — Generate Icons

Run headless Chrome to generate all 3 icon sizes from `extension/icon-gen.html`:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" --headless=new --screenshot=icons/icon128.png --window-size=128,128 --hide-scrollbars "file://$(pwd)/extension/icon-gen.html"
sips -z 48 48 icons/icon128.png --out icons/icon48.png
sips -z 16 16 icons/icon128.png --out icons/icon16.png
```

---

## Step 3 — Generate Store Assets

Run headless Chrome on the mockup HTML files:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Screenshot 1 — LinkedIn profile with popup (1280x800)
"$CHROME" --headless=new --screenshot=extension/screenshot1-1280x800.png \
  --window-size=1280,800 --hide-scrollbars \
  "file://$(pwd)/extension/screenshot-mockup.html"

# Screenshot 2 — Popup + features card (1280x800)
"$CHROME" --headless=new --screenshot=extension/screenshot2-1280x800.png \
  --window-size=1280,800 --hide-scrollbars \
  "file://$(pwd)/extension/screenshot2-mockup.html"

# Small promo tile (440x280)
"$CHROME" --headless=new --screenshot=extension/promo-small-440x280.png \
  --window-size=440,280 --hide-scrollbars \
  "file://$(pwd)/extension/promo-small-mockup.html"

# Marquee promo tile (1400x560)
"$CHROME" --headless=new --screenshot=extension/promo-marquee-1400x560.png \
  --window-size=1400,560 --hide-scrollbars \
  "file://$(pwd)/extension/promo-marquee-mockup.html"
```

---

## Step 4 — Package the ZIP

```bash
cd <repo-root>

zip -r outreachai-extension-v1.0.zip extension/ \
  --exclude "*.DS_Store" \
  --exclude "extension/screenshot*" \
  --exclude "extension/promo*" \
  --exclude "extension/icon-gen.html" \
  --exclude "extension/INSTALL.md" \
  --exclude "extension/RELEASE.md"
```

---

## Step 5 — Chrome Web Store Developer Account

**URL:** https://chrome.google.com/webstore/devconsole

1. Sign in with `outreachai.in@gmail.com`
2. One-time $5 developer registration fee (already paid)
3. Go to **Settings** → add and verify contact email `outreachai.in@gmail.com`

---

## Step 6 — Enable Chrome Web Store API

**URL:** https://console.developers.google.com/apis/api/chromewebstore.googleapis.com/overview?project=976291515130

Click **Enable**.

---

## Step 7 — Get OAuth Refresh Token

The Chrome Web Store API requires a Google OAuth token with the `chromewebstore` scope.

**One-time setup:**

1. Add `http://localhost:9999/callback` to authorized redirect URIs in Google Cloud Console → Clients → Web client 1

2. Add `outreachai.in@gmail.com` as a test user in Google Cloud Console → Audience

3. Run the auth script:
```bash
CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... node cws-auth.mjs
```
This opens a browser, you authorize, and saves tokens to `~/.cws_tokens.json`.

**Auth script location:** `cws-auth.mjs`

---

## Step 8 — Upload & Publish via API

```bash
CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... node cws-publish.mjs path/to/extension.zip
```

This script:
1. Refreshes the access token using the saved refresh token
2. Uploads the ZIP via `PUT /upload/chromewebstore/v1.1/items/{id}`
3. Publishes via `POST /chromewebstore/v1.1/items/{id}/publish`

Expected output:
```
✅ Got fresh access token
📦 Uploading package... Upload status: SUCCESS
🚀 Publishing to Chrome Web Store...
Publish status: { "status": ["OK"], "statusDetail": ["OK."] }
✅ Extension submitted for review!
```

---

## Step 9 — Store Listing (Manual — UI only)

These cannot be done via API and must be filled in the Chrome Web Store dashboard:

**URL:** https://chrome.google.com/webstore/devconsole → your item → Store listing

| Field | Value |
|-------|-------|
| Title | LinkedIn Outreach Assistant |
| Description | LinkedIn outreach automation — send personalized messages, track replies, and sync contacts to your OutReachAI dashboard |
| Category | Tools |
| Language | English |
| Store icon | `extension/icons/icon128.png` |
| Screenshot 1 | `extension/screenshot1-1280x800.png` |
| Screenshot 2 | `extension/screenshot2-1280x800.png` |
| Small promo tile | `extension/promo-small-440x280.png` |
| Marquee promo tile | `extension/promo-marquee-1400x560.png` |
| Official URL | https://outreachai.in |

---

## Step 10 — Privacy Page

Privacy policy is live at: **https://outreachai.in/privacy**

Source: `webapp/app/privacy/page.tsx`

Enter this URL in Chrome Web Store → Privacy → Privacy policy URL field.

---

## Step 11 — Privacy Justifications

Fill these in Chrome Web Store → Privacy page:

**Single purpose:**
> This extension helps users send personalized LinkedIn outreach messages powered by AI. It generates custom openers from prospect profiles, fills the LinkedIn message box with one click, and syncs sent contacts to the OutReachAI dashboard for tracking and follow-ups.

**storage:** Used to save dashboard login token, email, AI provider preference, and API key locally.

**alarms:** Used to schedule periodic background sync and follow-up reminders.

**notifications:** Used to notify users when a LinkedIn contact replies or a follow-up is due.

**host permissions:** linkedin.com — read profile data for AI personalization and fill message box. outreachai.in — authenticate user and sync contacts to dashboard.

Check all 3 disclosure boxes. Set Distribution to **Public**.

---

## Step 12 — Review & Go Live

- Google reviews in **1–3 business days**
- Email notification sent to `outreachai.in@gmail.com`
- Live URL: https://chromewebstore.google.com/detail/pldbpdkhdneapgdonahhallmjbodeejg

---

## Publishing Future Updates

For any code change, bump the version in `manifest.json`, repackage, and run:

```bash
# 1. Bump version in manifest.json (e.g. "version": "1.1")
# 2. Repackage
zip -r outreachai-extension-v1.1.zip extension/ --exclude "*.DS_Store" ...
# 3. Publish
node cws-publish.mjs
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Extension config, permissions, version |
| `extension/popup.html` | Extension popup UI |
| `extension/popup.js` | Popup logic, API_BASE URL |
| `extension/content.js` | LinkedIn page injection |
| `extension/background.js` | Service worker, alarms |
| `extension/icons/` | Icon PNGs (16, 48, 128px) |
| `extension/icon-gen.html` | Source HTML for icon generation |
| `extension/screenshot-mockup.html` | Screenshot 1 source |
| `extension/screenshot2-mockup.html` | Screenshot 2 source |
| `extension/promo-small-mockup.html` | Small promo tile source |
| `extension/promo-marquee-mockup.html` | Marquee promo tile source |
| `cws-auth.mjs` | One-time OAuth token script |
| `cws-publish.mjs` | Upload + publish script |
| `~/.cws_tokens.json` | Saved OAuth tokens (gitignored) |
