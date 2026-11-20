const API_BASE = 'https://outreachai.in'

function el(id) { return document.getElementById(id) }

// ── On load: restore saved settings ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  try {
    chrome.storage.local.get(['aiProvider', 'aiApiKey', 'dashToken', 'dashEmail', 'dashPlan'], (res) => {
      if (res.aiProvider && el('ai-provider')) el('ai-provider').value = res.aiProvider
      if (res.aiApiKey && el('ai-key'))        el('ai-key').value = res.aiApiKey
      if (res.dashToken) showConnected(res.dashEmail)
      else showLogin()
    })
  } catch { showLogin() }

  // ── Mode toggle (Login ↔ Sign Up) ───────────────────────────────────────────
  let mode = 'login'

  el('mode-login-btn')?.addEventListener('click', () => {
    mode = 'login'
    el('mode-login-btn').classList.add('active')
    el('mode-signup-btn').classList.remove('active')
    el('signup-name-row').style.display = 'none'
    el('connect-btn').textContent = 'Sign In'
    el('forgot-link').style.display = ''
    if (el('login-error')) el('login-error').style.display = 'none'
  })

  el('mode-signup-btn')?.addEventListener('click', () => {
    mode = 'signup'
    el('mode-signup-btn').classList.add('active')
    el('mode-login-btn').classList.remove('active')
    el('signup-name-row').style.display = 'block'
    el('connect-btn').textContent = 'Create Account'
    el('forgot-link').style.display = 'none'
    if (el('login-error')) el('login-error').style.display = 'none'
  })

  // ── OAuth buttons — open web app login page in a new tab ───────────────────
  el('oauth-google')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE}/login?source=extension` })
    // After user signs in via OAuth in the web tab, they can come back and
    // the popup auto-detects the session via the "Sync session" mechanism.
    // For now, show a hint to use "Sync session" or sign in with email.
  })

  el('oauth-github')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE}/login?source=extension` })
  })

  // ── Email connect / signup ───────────────────────────────────────────────────
  el('connect-btn')?.addEventListener('click', async () => {
    const email    = el('dash-email-input')?.value.trim()
    const password = el('dash-password-input')?.value
    const name     = el('dash-name-input')?.value.trim()
    const errEl    = el('login-error')
    const btn      = el('connect-btn')

    if (errEl) errEl.style.display = 'none'
    if (!email || !password) {
      if (errEl) { errEl.textContent = 'Enter email and password'; errEl.style.display = 'block' }
      return
    }
    if (mode === 'signup' && !name) {
      if (errEl) { errEl.textContent = 'Enter your full name'; errEl.style.display = 'block' }
      return
    }

    if (btn) { btn.textContent = mode === 'signup' ? 'Creating…' : 'Connecting…'; btn.disabled = true }

    try {
      if (mode === 'signup') {
        // Register then auto-login
        const regRes = await fetch(`${API_BASE}/api/extension/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })
        const regData = await regRes.json()
        if (!regRes.ok) {
          if (errEl) { errEl.textContent = regData.error || 'Registration failed'; errEl.style.display = 'block' }
          return
        }
        // Use the token returned directly from signup
        if (regData.token) {
          chrome.storage.local.set({ dashToken: regData.token, dashEmail: email, dashPlan: regData.plan || 'free', dashUrl: API_BASE })
          showConnected(email)
          return
        }
      }

      // Login (also used after signup if no token returned directly)
      const res  = await fetch(`${API_BASE}/api/extension/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok || !data.token) {
        if (errEl) { errEl.textContent = data.error || 'Invalid email or password'; errEl.style.display = 'block' }
        return
      }

      chrome.storage.local.set({ dashToken: data.token, dashEmail: email, dashPlan: data.plan || 'free', dashUrl: API_BASE })
      showConnected(email)
    } catch {
      if (errEl) { errEl.textContent = 'Could not reach dashboard — check your connection'; errEl.style.display = 'block' }
    } finally {
      if (btn) { btn.textContent = mode === 'signup' ? 'Create Account' : 'Sign In'; btn.disabled = false }
    }
  })

  // ── Disconnect ───────────────────────────────────────────────────────────────
  el('disconnect-btn')?.addEventListener('click', () => {
    chrome.storage.local.remove(['dashToken', 'dashEmail', 'dashPlan'])
    showLogin()
  })

  // ── AI API key save ──────────────────────────────────────────────────────────
  el('save-btn')?.addEventListener('click', () => {
    const provider = el('ai-provider')?.value
    const key      = el('ai-key')?.value.trim()
    if (!key) return
    chrome.storage.local.set({ aiProvider: provider, aiApiKey: key }, () => {
      if (el('saved')) { el('saved').style.display = 'block'; setTimeout(() => { el('saved').style.display = 'none' }, 2000) }
    })
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function showConnected(email) {
  if (el('dash-connected')) el('dash-connected').style.display = 'block'
  if (el('dash-login'))     el('dash-login').style.display     = 'none'
  if (el('dash-email'))     el('dash-email').textContent       = email || ''

  const badge = el('dash-plan-badge')
  if (badge) { badge.textContent = 'Beta — Free'; badge.className = 'plan-badge plan-pro' }

  if (el('ai-upgrade-msg'))    el('ai-upgrade-msg').style.display    = 'none'
  if (el('ai-controls'))       el('ai-controls').classList.remove('locked-overlay')
  if (el('ai-dashboard-note')) el('ai-dashboard-note').style.display = 'block'
  if (el('ai-local-key-section')) el('ai-local-key-section').style.display = 'none'
}

function showLogin() {
  if (el('dash-connected')) el('dash-connected').style.display = 'none'
  if (el('dash-login'))     el('dash-login').style.display     = 'block'
  if (el('ai-upgrade-msg')) el('ai-upgrade-msg').style.display = 'none'
  if (el('ai-controls'))    el('ai-controls').classList.remove('locked-overlay')
  if (el('ai-dashboard-note'))    el('ai-dashboard-note').style.display    = 'none'
  if (el('ai-local-key-section')) el('ai-local-key-section').style.display = 'block'
}
