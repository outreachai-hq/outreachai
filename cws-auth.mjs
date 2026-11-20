import { homedir } from 'os'
import { join } from 'path'
const TOKENS_PATH = process.env.CWS_TOKENS_PATH ?? join(homedir(), '.cws_tokens.json')
import { createServer } from 'http'
import { exec } from 'child_process'

const CLIENT_ID = process.env.CWS_CLIENT_ID
const CLIENT_SECRET = process.env.CWS_CLIENT_SECRET
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Set CWS_CLIENT_ID and CWS_CLIENT_SECRET'); process.exit(1) }
const REDIRECT = 'http://localhost:9999/callback'
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'

const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent(SCOPE)}&response_type=code&access_type=offline&prompt=consent`

console.log('\nOpening browser for Google authorization...\n')
exec(`open "${authUrl}"`)

const server = createServer(async (req, res) => {
  const code = new URL(req.url, 'http://localhost:9999').searchParams.get('code')
  if (!code) { res.end('No code'); return }

  res.end('<h2>✅ Authorized! Check your terminal.</h2><script>window.close()</script>')
  server.close()

  // Exchange code for tokens
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' })
  })
  const tokens = await r.json()

  if (tokens.refresh_token) {
    console.log('\n✅ REFRESH TOKEN (save this):\n')
    console.log(tokens.refresh_token)
    console.log('\nACCESS TOKEN:\n')
    console.log(tokens.access_token)

    // Save to file
    const fs = await import('fs')
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
    console.log(`\n✅ Saved to ${TOKENS_PATH}\n`)
  } else {
    console.log('Error:', JSON.stringify(tokens))
  }
})

server.listen(9999, () => console.log('Waiting for auth callback on port 9999...'))
