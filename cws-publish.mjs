import { homedir } from 'os'
import { join } from 'path'
const TOKENS_PATH = process.env.CWS_TOKENS_PATH ?? join(homedir(), '.cws_tokens.json')
import { readFileSync, createReadStream } from 'fs'

const EXTENSION_ID = process.env.CWS_EXTENSION_ID ?? 'nhlhakhdnppkocnlmaaomimdfnjoghnn'
const ZIP = process.argv[2] ?? new URL('./outreachai-extension.zip', import.meta.url).pathname
const CLIENT_ID = process.env.CWS_CLIENT_ID
const CLIENT_SECRET = process.env.CWS_CLIENT_SECRET
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Set CWS_CLIENT_ID and CWS_CLIENT_SECRET'); process.exit(1) }

// Refresh the access token
const tokens = JSON.parse(readFileSync(TOKENS_PATH))
const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token'
  })
})
const { access_token } = await refreshRes.json()
console.log('✅ Got fresh access token')

// Upload ZIP
console.log('\n📦 Uploading package...')
const zipData = readFileSync(ZIP)
const uploadRes = await fetch(
  `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${EXTENSION_ID}`,
  {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${access_token}`, 'x-goog-api-version': '2' },
    body: zipData
  }
)
const uploadData = await uploadRes.json()
console.log('Upload status:', uploadData.uploadState ?? uploadData.error?.message)

if (uploadData.uploadState !== 'SUCCESS') {
  console.error('Upload failed:', JSON.stringify(uploadData, null, 2))
  process.exit(1)
}

// Publish
console.log('\n🚀 Publishing to Chrome Web Store...')
const pubRes = await fetch(
  `https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}/publish`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'x-goog-api-version': '2', 'Content-Length': '0' }
  }
)
const pubData = await pubRes.json()
console.log('Publish status:', JSON.stringify(pubData, null, 2))

if (pubData.status?.includes('OK') || pubData.statusDetail?.includes('OK')) {
  console.log('\n✅ Extension submitted for review!')
} else {
  console.log('\nCheck status above.')
}
