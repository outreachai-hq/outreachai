// OutreachAI for LinkedIn — Content Script

// Silently catch "Extension context invalidated" errors globally
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message?.includes('Extension context invalidated') ||
      e.reason?.message?.includes('Cannot read properties of undefined')) {
    e.preventDefault() // suppress the error
  }
})

;(function () {
  if (document.getElementById('lia-panel')) return; // already injected

  // ─── Extension context guard ─────────────────────────────────────────────────
  // Detects when extension is reloaded but old content script is still running
  function isContextValid() {
    try {
      // Accessing chrome.runtime.id throws if context is invalidated
      return typeof chrome !== 'undefined' && !!chrome.runtime?.id
    } catch { return false }
  }

  async function safeStorageGet(keys) {
    if (!isContextValid()) return {}
    try { return await chrome.storage.local.get(keys) } catch { return {} }
  }

  async function safeStorageSet(obj) {
    if (!isContextValid()) return
    try { await chrome.storage.local.set(obj) } catch {}
  }

  async function safeAlarmCreate(name, opts) {
    if (!isContextValid()) return
    try { await chrome.alarms.create(name, opts) } catch {}
  }

  async function safeAlarmClear(name) {
    if (!isContextValid()) return
    try { await chrome.alarms.clear(name) } catch {}
  }

  async function safeRuntimeSendMessage(msg) {
    if (!isContextValid()) return null
    try { return await chrome.runtime.sendMessage(msg) } catch { return null }
  }

  // ─── Scrape profile data from current page ──────────────────────────────────
  function getProfileData() {
    const url = window.location.href;
    const isProfile = url.includes('/in/') || url.includes('/messaging/thread/');
    const profileId = url.includes('/in/')
      ? url.split('/in/')[1].split('/')[0].split('?')[0]
      : '';

    // ── Messaging thread: extract participant from conversation header ──────────
    if (url.includes('/messaging/thread/')) {
      // Name from thread header
      const threadNameEl =
        document.querySelector('.msg-thread__top-actions-bar .msg-thread-heading__name') ||
        document.querySelector('.msg-s-event-listitem--other .msg-s-message-group__profile-link') ||
        document.querySelector('.msg-thread-heading__link') ||
        document.querySelector('[class*="thread-header"] span[dir="ltr"]') ||
        document.querySelector('.msg-thread-lead__name') ||
        document.querySelector('h2[class*="thread"]');

      // Profile link (to get profileId and linkedinUrl)
      const profileLinkEl =
        document.querySelector('.msg-thread__top-actions-bar a[href*="/in/"]') ||
        document.querySelector('a.app-aware-link[href*="linkedin.com/in/"]') ||
        document.querySelector('a[href*="/in/"][class*="thread"]');

      const threadProfileUrl = profileLinkEl ? profileLinkEl.getAttribute('href') : null;
      const threadProfileMatch = threadProfileUrl?.match(/\/in\/([^/?]+)/);
      const threadProfileId = threadProfileMatch ? threadProfileMatch[1] : '';

      // Headline appears below name in thread header on some LinkedIn builds
      const threadHeadlineEl =
        document.querySelector('.msg-thread__top-actions-bar .msg-thread-lead__headline') ||
        document.querySelector('.msg-thread-lead__company') ||
        document.querySelector('[class*="thread-header"] .t-12');

      const name = threadNameEl ? threadNameEl.innerText.trim().split('\n')[0] : '';
      const firstName = name.split(' ')[0] || '';
      const lastName = name.split(' ').slice(1).join(' ') || '';
      const headline = threadHeadlineEl ? threadHeadlineEl.innerText.trim().split('\n')[0] : '';
      const atMatch = headline.match(/ at (.+)$/i);
      const company = atMatch ? atMatch[1].trim() : '';
      const linkedinUrl = threadProfileUrl ? `https://www.linkedin.com${threadProfileUrl}` : '';

      return {
        profileId: threadProfileId || name.toLowerCase().replace(/\s+/g, '-'),
        name, firstName, lastName, headline, company,
        linkedinUrl,
        about: '', recentPost: '', recentPosts: [], skills: [], location: '',
        seniority: headline ? (() => {
          const h = headline.toLowerCase();
          if (/\b(ceo|cto|coo|cfo|chief|founder|co-founder|owner|president)\b/.test(h)) return 'C-Suite / Founder';
          if (/\b(vp|vice president|head of|director)\b/.test(h)) return 'VP / Director';
          if (/\b(senior|lead|principal|staff|manager)\b/.test(h)) return 'Senior / Manager';
          return 'Mid-level';
        })() : '',
        isProfile: !!name,
        isMessagingThread: true,
      };
    }

    // ── Profile page ──────────────────────────────────────────────────────────

    // ── Name: try every known LinkedIn selector, then fall back to page title ──
    const nameEl =
      document.querySelector('h1.text-heading-xlarge') ||
      document.querySelector('h1[class*="text-heading"]') ||
      document.querySelector('h1[class*="heading"]') ||
      document.querySelector('.pv-text-details__left-panel h1') ||
      document.querySelector('.ph5 h1') ||
      document.querySelector('.pv-top-card h1') ||
      document.querySelector('[data-view-name="profile-card"] h1') ||
      document.querySelector('.profile-header h1') ||
      document.querySelector('h1[class*="name"]') ||
      document.querySelector('section.artdeco-card h1') ||
      // any visible h1 with at least 2 chars
      [...document.querySelectorAll('h1')].find(el =>
        el.offsetParent !== null && el.textContent.trim().length >= 2
      );

    // Page title fallback: "Firstname Lastname | LinkedIn"
    // Activity pages: "(19) Activity | Firstname Lastname | LinkedIn"
    let nameRaw = nameEl ? nameEl.innerText.trim() : '';
    if (!nameRaw && document.title.includes('| LinkedIn')) {
      const parts = document.title.split('|').map(p => p.trim());
      // Skip segments that look like "(N) Activity" or navigation labels
      const namePart = parts.find(p => p.length > 2 && !/^\(\d+\)/.test(p) && !/^activity$/i.test(p));
      nameRaw = namePart || parts[0];
    }
    // Strip parenthetical suffix like "(Immediate Joiner)" from name
    const name = nameRaw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const firstName = name.split(' ')[0] || '';
    const lastName = name.split(' ').slice(1).join(' ') || '';

    // ── Headline ──────────────────────────────────────────────────────────────
    // Strategy 1: known class selectors
    let headline = '';
    for (const sel of [
      '.text-body-medium.break-words', '.pv-text-details__left-panel .text-body-medium',
      '.ph5 .text-body-medium', '[data-generated-suggestion-target]', '[class*="headline"]',
    ]) {
      const el = document.querySelector(sel);
      const t = el ? (el.innerText || el.textContent || '').trim().split('\n')[0] : '';
      if (t.length > 20 && t.length < 400) { headline = t; break; }
    }
    // Strategy 2: first span[aria-hidden="true"] after the h1 (universal LinkedIn pattern)
    if (!headline) {
      const h1 = document.querySelector('h1');
      if (h1) {
        for (const s of document.querySelectorAll('span[aria-hidden="true"]')) {
          if (!(h1.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          const t = (s.innerText || s.textContent || '').trim().split('\n')[0];
          if (t.length > 25 && t.length < 350 && !/follower|connection|\d+\s*follower/i.test(t) && !/^\d/.test(t)) {
            headline = t; break;
          }
        }
      }
    }

    // ── Company from headline or experience section ───────────────────────────
    const atMatch = headline.match(/ at (.+)$/i);
    let company = atMatch ? atMatch[1].trim() : '';

    if (!company) {
      for (const sel of [
        '#experience ~ .pvs-list .pvs-entity .t-14.t-normal:not(.t-black--light) span[aria-hidden]',
        '#experience + div .pvs-list .t-14.t-normal span[aria-hidden]',
        '.experience-item__title',
        '[data-field="experience_company_logo"] + div .t-14',
        '.pvs-entity .t-14.t-normal:not(.t-black--light)',
        '.pv-profile-section .pv-position-entity .pv-entity__secondary-title',
      ]) {
        const el = document.querySelector(sel);
        if (el) {
          const raw = (el.innerText || el.textContent || '').trim().split('\n')[0].replace(/\s*·.*$/, '').trim();
          if (raw && raw.length < 80) { company = raw; break; }
        }
      }
    }
    // Universal fallback: first /company/ link text on the page
    if (!company) {
      for (const link of document.querySelectorAll('a[href*="/company/"]')) {
        const span = link.querySelector('span[aria-hidden="true"]');
        const t = (span ? (span.innerText || span.textContent) : (link.innerText || link.textContent) || '').trim().split('\n')[0];
        if (t && t.length > 1 && t.length < 80 && !/follow|see all/i.test(t)) { company = t; break; }
      }
    }

    // ── About section ─────────────────────────────────────────────────────────
    let about = '';
    // Strategy 1: known selectors
    for (const sel of [
      '#about ~ .display-flex .pv-shared-text-with-see-more span[aria-hidden="true"]',
      '[id="about"] ~ div span[aria-hidden="true"]',
      '[id="about"] + * span[aria-hidden="true"]',
      '.pv-about__summary-text',
    ]) {
      const el = document.querySelector(sel);
      if (el) { about = (el.innerText || el.textContent || '').trim().slice(0, 500); break; }
    }
    // Strategy 2: find About section by h2 heading, then grab its first long span
    if (!about) {
      for (const section of document.querySelectorAll('section')) {
        const h2 = section.querySelector('h2');
        if (!h2) continue;
        if (!(h2.innerText || h2.textContent || '').trim().toLowerCase().includes('about')) continue;
        for (const s of section.querySelectorAll('span[aria-hidden="true"]')) {
          const t = (s.innerText || s.textContent || '').trim();
          if (t.length > 40) { about = t.slice(0, 500); break; }
        }
        if (about) break;
      }
    }
    // Strategy 3: first long aria-hidden span that doesn't look like a post
    if (!about) {
      for (const s of document.querySelectorAll('span[aria-hidden="true"]')) {
        const t = (s.innerText || s.textContent || '').trim();
        if (t.length > 100 && t.length < 1500 && !t.includes('#') && !t.startsWith('http') && !/^\d/.test(t)) {
          about = t.slice(0, 500); break;
        }
      }
    }

    // Recent posts — grab last 3 from activity feed or profile posts
    const postEls = [
      ...document.querySelectorAll('.feed-shared-update-v2__description span[dir="ltr"]'),
      ...document.querySelectorAll('.update-components-text span[dir="ltr"]'),
      ...document.querySelectorAll('.occludable-update span[dir="ltr"]'),
      ...document.querySelectorAll('.feed-shared-text span[dir="ltr"]'),
      ...document.querySelectorAll('.feed-shared-inline-show-more-text span[dir="ltr"]'),
      ...document.querySelectorAll('[class*="feed-shared-update"] span[dir="ltr"]'),
      ...document.querySelectorAll('article span[dir="ltr"]'),
    ];
    const recentPosts = [...new Set(
      postEls.map(el => el.innerText.trim()).filter(t => t.length > 30)
    )].slice(0, 3).map(t => t.slice(0, 300));
    const recentPost = recentPosts[0] || '';

    // Top skills
    const skillEls = document.querySelectorAll(
      '.pv-skill-category-entity__name, [class*="skill-category-entity"] span, .pvs-entity span[aria-hidden="true"]'
    );
    const skills = [...new Set(
      [...skillEls].map(el => el.innerText.trim()).filter(s => s && s.length < 50)
    )].slice(0, 6);

    // Location
    const locationEl =
      document.querySelector('.pv-text-details__left-panel .text-body-small:not(.break-words)') ||
      document.querySelector('[class*="location"] .text-body-small');
    const location = locationEl ? locationEl.innerText.trim().split('\n')[0] : '';

    // Infer seniority from headline
    const h = headline.toLowerCase();
    let seniority = 'Mid-level';
    if (/\b(ceo|cto|coo|cfo|chief|founder|co-founder|owner|president|managing director)\b/.test(h)) seniority = 'C-Suite / Founder';
    else if (/\b(vp|vice president|head of|director)\b/.test(h)) seniority = 'VP / Director';
    else if (/\b(senior|lead|principal|staff|manager|engineering manager)\b/.test(h)) seniority = 'Senior / Manager';
    else if (/\b(junior|associate|intern|graduate|entry)\b/.test(h)) seniority = 'Junior';

    return { profileId, name, firstName, lastName, headline, company, about, recentPost, recentPosts, skills, location, seniority, isProfile };
  }

  // ─── Fill the LinkedIn message compose box ──────────────────────────────────
  function fillMessageBox(text) {
    const selectors = [
      '.msg-form__contenteditable',
      '.msg-form__msg-content-container [contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder]',
      '[contenteditable="true"].msg-form__contenteditable',
      '[aria-label*="essage"][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
    ];
    let box = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.isContentEditable) { box = el; break; }
    }

    if (box) {
      box.click();
      box.focus();
      // Use Range API to select all content, delete it, then insertText
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(box);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('delete', false, null);
        const inserted = document.execCommand('insertText', false, text);
        if (inserted) {
          showStatus('✅ Message filled! Hit Send when ready.', 'success');
          return;
        }
      } catch (_) {}

      // ClipboardEvent paste fallback — triggers React's onChange in contenteditable
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        setTimeout(() => {
          const filled = (box.innerText || box.textContent || '').trim();
          if (filled.length > 0) {
            showStatus('✅ Message filled! Hit Send when ready.', 'success');
          } else {
            _clipboardFallback(text);
          }
        }, 150);
        return;
      } catch (_) {}
    }

    _clipboardFallback(text);
  }

  function _clipboardFallback(text) {
    navigator.clipboard.writeText(text).then(() => {
      showStatus('✅ Copied! Click the message box, then Cmd+V to paste.', 'success');
    }).catch(() => {
      showStatus('❌ No message box found on this page — copy text from preview above.', 'error');
    });
  }

  // ─── Template processing ────────────────────────────────────────────────────
  function applyTemplate(template, vars) {
    return template
      .replace(/\{\{firstName\}\}/gi, vars.firstName || '[First Name]')
      .replace(/\{\{lastName\}\}/gi, vars.lastName || '[Last Name]')
      .replace(/\{\{name\}\}/gi, vars.name || '[Name]')
      .replace(/\{\{company\}\}/gi, vars.company || '[Company]')
      .replace(/\{\{headline\}\}/gi, vars.headline || '[Headline]');
  }

  // ─── Status message ─────────────────────────────────────────────────────────
  function showStatus(msg, type) {
    const el = document.getElementById('lia-status-msg');
    el.textContent = msg;
    el.className = type === 'success' ? 'lia-success' : 'lia-error';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3500);
  }

  // ─── Build UI ───────────────────────────────────────────────────────────────
  const DEFAULT_TEMPLATES = [
    {
      id: 't1',
      name: 'Initial outreach',
      message: "Hi {{firstName}},\n\nI noticed your work at {{company}} and wanted to reach out. I think there could be a real overlap worth exploring.\n\nWould love to connect — no pitch, just a quick conversation."
    },
    {
      id: 't2',
      name: 'Follow-up #1 (3 days)',
      message: "Hi {{firstName}},\n\nFollowing up on my earlier message — I know inboxes get busy.\n\nIf a 15-min call this week works, I'd love to share what I'm building and hear your thoughts."
    },
    {
      id: 't3',
      name: 'Follow-up #2 (7 days)',
      message: "Hey {{firstName}},\n\nLast follow-up, I promise! I genuinely think what you're doing at {{company}} aligns with what I'm working on.\n\nHappy to share more if you're even slightly curious."
    },
    {
      id: 't4',
      name: 'Connection request note',
      message: "Hi {{firstName}}, I noticed your work at {{company}} and would love to connect and exchange ideas."
    }
  ];

  // Session-scoped cache — load from dashboard once per page, avoid re-fetching on every call
  let _templatesSessionCache = null;

  async function getTemplates() {
    if (_templatesSessionCache) return _templatesSessionCache;

    const { dashToken, dashUrl } = await safeStorageGet(['dashToken', 'dashUrl']);
    if (dashToken && dashUrl) {
      try {
        const res = await fetch(`${dashUrl}/api/extension/templates`, {
          headers: { 'Authorization': `Bearer ${dashToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.templates && data.templates.length > 0) {
            _templatesSessionCache = data.templates;
            return _templatesSessionCache;
          }
        }
      } catch { /* fall through to local cache */ }
    }
    const cached = await safeStorageGet('templates');
    _templatesSessionCache = (cached.templates && cached.templates.length) ? cached.templates : DEFAULT_TEMPLATES;
    return _templatesSessionCache;
  }

  async function saveTemplates(templates) {
    _templatesSessionCache = templates;
    await safeStorageSet({ templates });
    // Templates are managed in the dashboard webapp — edits here are local to this session.
  }

  async function getContacts() {
    const res = await safeStorageGet('contacts');
    return res.contacts || {};
  }

  async function saveContacts(contacts) {
    await safeStorageSet({ contacts });
  }

  // ─── Schedule follow-up alarm ────────────────────────────────────────────────
  async function scheduleFollowUp(profileId, daysFromNow) {
    if (!profileId) return;
    const delayMinutes = daysFromNow * 24 * 60;
    await safeAlarmCreate(`followup_${profileId}`, { delayInMinutes: delayMinutes });
  }

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Render contacts list ────────────────────────────────────────────────────
  async function renderContacts() {
    const contacts = await getContacts();
    const list = document.getElementById('lia-contacts-list');
    const entries = Object.values(contacts).sort((a, b) => b.sentAt - a.sentAt);
    if (!entries.length) {
      list.innerHTML = '<p style="color:#999;font-size:12px;text-align:center;padding:8px">No contacts tracked yet.</p>';
      return;
    }
    list.innerHTML = entries.map(c => {
      const date = new Date(c.sentAt).toLocaleDateString();
      const followupDate = c.followupAt ? new Date(c.followupAt).toLocaleDateString() : null;
      const pid = _esc(c.profileId);
      return `
        <div class="lia-contact-item">
          <div class="lia-contact-name">${_esc(c.name || c.profileId)}</div>
          <div class="lia-contact-meta">${c.company ? _esc(c.company) + ' · ' : ''}Sent ${date}</div>
          <span class="lia-contact-status status-${c.status}">${c.status === 'sent' ? 'Messaged' : c.status === 'followup' ? 'Follow-up scheduled' : 'Replied'}</span>
          ${followupDate ? `<div class="lia-contact-meta" style="margin-top:4px">Follow-up: ${followupDate}</div>` : ''}
          <div style="display:flex;gap:4px;margin-top:6px">
            <button class="lia-btn lia-btn-secondary" style="margin:0;font-size:11px;padding:4px"
              data-action="mark-replied" data-pid="${pid}">Mark Replied</button>
            <button class="lia-btn lia-btn-danger" style="margin:0;font-size:11px;padding:4px"
              data-action="delete-contact" data-pid="${pid}">Remove</button>
          </div>
        </div>`;
    }).join('');
  }

  // ─── Render template editor ──────────────────────────────────────────────────
  async function renderTemplateEditor() {
    const templates = await getTemplates();
    const sel = document.getElementById('lia-template-select');
    sel.innerHTML = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    loadSelectedTemplate();
  }

  function loadSelectedTemplate() {
    getTemplates().then(templates => {
      const sel = document.getElementById('lia-template-select');
      const tmpl = templates.find(t => t.id === sel.value) || templates[0];
      if (!tmpl) return;
      document.getElementById('lia-template-name').value = tmpl.name;
      const profile = getProfileData();
      document.getElementById('lia-template-preview').value = applyTemplate(tmpl.message, profile);
    });
  }

  // ─── Scrape posts from current page ─────────────────────────────────────────
  function scrapePosts() {
    const profile = getProfileData();

    // Selectors covering all known LinkedIn post container patterns
    const containerSelectors = [
      '.feed-shared-update-v2', '.occludable-update',
      '[data-id*="urn:li:activity"]', 'article.artdeco-card',
      '[class*="feed-shared-update"]', '.scaffold-finite-scroll__content > div > div',
    ];
    const containerSet = new Set();
    for (const sel of containerSelectors) {
      for (const el of document.querySelectorAll(sel)) containerSet.add(el);
    }
    const containers = [...containerSet];

    const posts = [];
    const seen = new Set();
    const profileId = profile.profileId || window.location.pathname.split('/in/')[1]?.split('/')[0] || '';
    const profileName = profile.name || '';
    const profileUrl = profile.linkedinUrl || `https://www.linkedin.com/in/${profileId}`;

    for (const container of containers) {
      const textEl =
        container.querySelector('.feed-shared-update-v2__description span[dir="ltr"]') ||
        container.querySelector('.update-components-text span[dir="ltr"]') ||
        container.querySelector('.feed-shared-text span[dir="ltr"]') ||
        container.querySelector('.feed-shared-inline-show-more-text span[dir="ltr"]') ||
        container.querySelector('span[dir="ltr"]');
      const postText = textEl ? textEl.innerText.trim() : '';
      if (!postText || postText.length < 20) continue;
      if (seen.has(postText.slice(0, 100))) continue;
      seen.add(postText.slice(0, 100));

      const timeLink = container.querySelector('a[href*="activity"]') ||
                       container.querySelector('.feed-shared-actor__sub-description a') ||
                       container.querySelector('a[href*="ugcPost"]');
      const postUrl = timeLink ? timeLink.getAttribute('href') : null;
      const absolutePostUrl = postUrl
        ? (postUrl.startsWith('http') ? postUrl : `https://www.linkedin.com${postUrl}`)
        : null;
      const dateEl = container.querySelector('time') ||
                     container.querySelector('.feed-shared-actor__sub-description span');
      const postedAt = dateEl ? (dateEl.getAttribute('datetime') || dateEl.innerText.trim()) : null;
      const likesEl = container.querySelector('.social-counts-reactions__count, [class*="reaction-count"]');
      const commentsEl = container.querySelector('.social-counts-comments, [class*="comment-count"]');
      const likes = likesEl ? parseInt(likesEl.innerText.trim().replace(/,/g, '')) : null;
      const comments = commentsEl ? parseInt(commentsEl.innerText.trim().replace(/,/g, '')) : null;

      posts.push({
        profileId, profileName, profileUrl, postText,
        postUrl: absolutePostUrl, postedAt: postedAt || null,
        likes: isNaN(likes) ? null : likes,
        comments: isNaN(comments) ? null : comments,
      });
      if (posts.length >= 10) break;
    }

    // ── Fallback: collect all substantial span[dir="ltr"] directly ────────────
    // Works on activity pages where container class names don't match
    if (posts.length === 0) {
      for (const s of document.querySelectorAll('span[dir="ltr"]')) {
        const postText = s.innerText?.trim() || '';
        if (postText.length < 50) continue;
        if (seen.has(postText.slice(0, 100))) continue;
        seen.add(postText.slice(0, 100));
        // Try to find a nearby activity link for the post URL
        const container = s.closest('[data-id], article, [class*="update"], [class*="feed"]') || s.parentElement;
        const timeLink = container?.querySelector('a[href*="activity"], a[href*="ugcPost"]');
        const postUrl = timeLink ? timeLink.getAttribute('href') : null;
        posts.push({
          profileId, profileName, profileUrl, postText,
          postUrl: postUrl ? (postUrl.startsWith('http') ? postUrl : `https://www.linkedin.com${postUrl}`) : null,
          postedAt: null, likes: null, comments: null,
        });
        if (posts.length >= 10) break;
      }
    }

    return posts;
  }

  // ─── Capture and save posts to dashboard ─────────────────────────────────────
  async function captureAndSavePosts() {
    const statusEl = document.getElementById('lia-posts-status');
    const btn = document.getElementById('lia-capture-posts-btn');

    const { dashToken, dashUrl } = await safeStorageGet(['dashToken', 'dashUrl']);
    if (!dashToken || !dashUrl) {
      statusEl.textContent = '⚠️ Connect to OutreachAI dashboard in the extension popup first.';
      statusEl.style.color = '#d97706';
      statusEl.style.display = 'block';
      return;
    }

    statusEl.textContent = 'Scanning visible posts…';
    statusEl.style.color = '#7c3aed';
    statusEl.style.display = 'block';

    btn.disabled = true;
    btn.textContent = '⏳ Scanning…';

    const posts = scrapePosts();

    if (posts.length === 0) {
      statusEl.textContent = '⚠️ No posts found on this page. Try the "View Activity" link below.';
      statusEl.style.color = '#d97706';
      statusEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '📸 Capture Posts';
      return;
    }

    statusEl.textContent = `Found ${posts.length} post${posts.length !== 1 ? 's' : ''}. Saving…`;
    statusEl.style.color = '#7c3aed';
    statusEl.style.display = 'block';

    try {
      const res = await fetch(`${dashUrl}/api/captured-posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dashToken}`,
        },
        body: JSON.stringify({ posts }),
      });

      if (res.ok) {
        const data = await res.json();
        const msg = data.saved > 0
          ? `✅ Saved ${data.saved} new post${data.saved !== 1 ? 's' : ''}${data.skippedDuplicates ? ` (${data.skippedDuplicates} already saved)` : ''}`
          : `✅ All posts already saved (${data.skippedDuplicates} duplicates skipped)`;
        statusEl.textContent = msg;
        statusEl.style.color = '#16a34a';
      } else {
        const err = await res.json().catch(() => ({}));
        statusEl.textContent = '❌ ' + (err.error || 'Save failed');
        statusEl.style.color = '#dc2626';
      }
    } catch {
      statusEl.textContent = '❌ Network error — check dashboard connection';
      statusEl.style.color = '#dc2626';
    }

    btn.disabled = false;
    btn.textContent = '📸 Capture Posts';
    setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
  }

  // ─── Inject panel HTML ───────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'lia-panel';
  panel.innerHTML = `
    <div id="lia-header">
      <h3>OutreachAI</h3>
      <button id="lia-toggle" title="Minimize">−</button>
    </div>
    <div id="lia-body">
      <div id="lia-profile-info">Loading profile...</div>

      <div id="lia-tabs">
        <div class="lia-tab active" data-tab="compose">Compose</div>
        <div class="lia-tab" data-tab="templates">Templates</div>
        <div class="lia-tab" data-tab="tracker">Tracker</div>
        <div class="lia-tab" data-tab="posts">Posts</div>
        <div class="lia-tab" data-tab="settings">⚙</div>
      </div>

      <!-- COMPOSE TAB -->
      <div id="tab-compose" class="lia-section active">
        <div class="lia-label">Template</div>
        <select id="lia-template-select" class="lia-select"></select>

        <div style="margin-top:8px" class="lia-label">Preview & Edit</div>
        <textarea id="lia-template-preview" class="lia-textarea" rows="6"></textarea>
        <div class="lia-vars">
          Variables:
          <span class="lia-var-chip" data-var="{{firstName}}">{{firstName}}</span>
          <span class="lia-var-chip" data-var="{{lastName}}">{{lastName}}</span>
          <span class="lia-var-chip" data-var="{{company}}">{{company}}</span>
          <span class="lia-var-chip" data-var="{{headline}}">{{headline}}</span>
        </div>

        <button id="lia-ai-btn" class="lia-btn" style="background:#7c3aed;color:white;margin-top:8px">✨ AI Personalize First Line</button>
        <div id="lia-ai-status" style="font-size:11px;color:#7c3aed;margin-top:4px;display:none;text-align:center"></div>

        <!-- AI tone/chat refinement pane — shown after AI generates a line -->
        <div id="lia-ai-chat" style="display:none;margin-top:8px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:8px">
          <div style="font-size:11px;color:#7c3aed;font-weight:600;margin-bottom:6px">✨ Refine AI Opener</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px" id="lia-tone-chips">
            <span class="lia-tone-chip" data-tone="Formal">Formal</span>
            <span class="lia-tone-chip" data-tone="Casual">Casual</span>
            <span class="lia-tone-chip" data-tone="Witty">Witty</span>
            <span class="lia-tone-chip" data-tone="Direct">Direct</span>
            <span class="lia-tone-chip" data-tone="Empathetic">Empathetic</span>
          </div>
          <textarea id="lia-ai-context" class="lia-textarea" rows="2" placeholder="Extra context or instruction… (e.g. mention their post about AI)" style="min-height:44px;font-size:12px"></textarea>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button id="lia-ai-regen" class="lia-btn" style="flex:1;background:#7c3aed;color:white;margin:0;font-size:11px;padding:6px">↺ Regenerate</button>
            <button id="lia-ai-use" class="lia-btn lia-btn-secondary" style="flex:1;margin:0;font-size:11px;padding:6px">✓ Done</button>
          </div>
        </div>

        <div class="lia-followup-row">
          <span>Follow-up in</span>
          <input id="lia-followup-days" type="number" class="lia-input" value="3" min="1" max="30" style="width:56px">
          <span>days</span>
        </div>

        <button id="lia-fill-btn" class="lia-btn lia-btn-primary">📋 Fill Message Box</button>
        <button id="lia-track-btn" class="lia-btn lia-btn-secondary">Log as Sent + Schedule Follow-up</button>
        <button id="lia-add-lead-btn" class="lia-btn" style="background:#7c3aed;color:white;margin-top:4px">⬆️ Add to Lead List + AI Opener</button>
        <div id="lia-add-lead-status" style="font-size:11px;color:#7c3aed;margin-top:4px;display:none;text-align:center"></div>
        <div id="lia-status-msg"></div>
      </div>

      <!-- TEMPLATES TAB -->
      <div id="tab-templates" class="lia-section">
        <div class="lia-label">Edit Template</div>
        <select id="lia-edit-select" class="lia-select"></select>
        <div style="margin-top:8px" class="lia-label">Name</div>
        <input id="lia-template-name" class="lia-input" type="text" placeholder="Template name">
        <div style="margin-top:6px" class="lia-label">Message (use variables)</div>
        <textarea id="lia-template-body" class="lia-textarea" rows="6"></textarea>
        <div class="lia-vars">
          <span class="lia-var-chip" data-var2="{{firstName}}">{{firstName}}</span>
          <span class="lia-var-chip" data-var2="{{company}}">{{company}}</span>
          <span class="lia-var-chip" data-var2="{{headline}}">{{headline}}</span>
        </div>
        <button id="lia-save-tmpl" class="lia-btn lia-btn-primary">Save Template</button>
        <button id="lia-new-tmpl" class="lia-btn lia-btn-secondary">+ New Template</button>
        <div style="font-size:10px;color:#9ca3af;margin-top:8px;line-height:1.4">
          💡 To keep templates across sessions, create them in the OutreachAI dashboard.
        </div>
      </div>

      <!-- TRACKER TAB -->
      <div id="tab-tracker" class="lia-section">
        <div id="lia-contacts-list"></div>
      </div>

      <!-- POSTS TAB -->
      <div id="tab-posts" class="lia-section">
        <div style="font-size:12px;color:#555;margin-bottom:8px;line-height:1.4">
          Capture visible posts from this person's LinkedIn profile and save them to your dashboard for AI-powered repurposing.
        </div>
        <button id="lia-capture-posts-btn" class="lia-btn" style="background:#0a66c2;color:white;margin-top:4px">📸 Capture Posts</button>
        <div id="lia-posts-status" style="font-size:11px;margin-top:6px;display:none;line-height:1.4"></div>
        <div style="margin-top:10px;font-size:11px;color:#6b7280">
          💡 Tip: For more posts, visit their
          <span id="lia-activity-link-text" style="color:#0a66c2;cursor:pointer;text-decoration:underline">Activity page</span>
          first, then capture.
        </div>
        <div style="margin-top:8px">
          <a id="lia-dashboard-posts-link" href="#" target="_blank"
            style="font-size:11px;color:#7c3aed;text-decoration:none">
            → View & Transform in Dashboard ↗
          </a>
        </div>
      </div>

      <!-- SETTINGS TAB -->
      <div id="tab-settings" class="lia-section">
        <div class="lia-settings-card">
          <div class="lia-settings-card-title" style="color:#0a66c2">🔗 Dashboard Sync</div>
          <div id="lia-settings-connected" style="display:none">
            <div style="font-size:12px;font-weight:600;color:#0a66c2" id="lia-settings-email-display"></div>
            <p style="font-size:11px;color:#16a34a;margin:4px 0">✅ Contacts syncing to dashboard</p>
            <button class="lia-btn lia-btn-danger" id="lia-settings-disconnect" style="font-size:11px;padding:5px;margin-top:2px">Disconnect</button>
          </div>
          <div id="lia-settings-login">
            <div class="lia-label" style="margin-top:2px">Email</div>
            <input type="email" id="lia-settings-email-input" class="lia-input" placeholder="you@example.com">
            <div class="lia-label">Password</div>
            <input type="password" id="lia-settings-password-input" class="lia-input" placeholder="••••••••">
            <div id="lia-settings-login-error" style="display:none;color:#dc2626;font-size:11px;margin-bottom:4px"></div>
            <button class="lia-btn lia-btn-primary" id="lia-settings-connect">Connect</button>
            <p style="text-align:center;font-size:11px;margin-top:6px">
              <a href="https://outreachai.in/signup" target="_blank" style="color:#0a66c2">Create account →</a>
            </p>
          </div>
        </div>
        <div class="lia-settings-card" style="margin-top:8px">
          <div class="lia-settings-card-title" style="color:#7c3aed">✨ AI Personalization</div>
          <div id="lia-settings-ai-dash-note" style="display:none;font-size:11px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 8px;margin-top:4px">
            ✅ Using AI keys from your dashboard settings.<br>
            <a href="https://outreachai.in/settings" target="_blank" style="color:#7c3aed;text-decoration:underline;font-size:11px">Configure keys in Dashboard Settings →</a>
          </div>
          <div id="lia-settings-ai-local">
            <div class="lia-label" style="margin-top:4px">Provider</div>
            <select id="lia-settings-provider" class="lia-select">
              <option value="claude">Claude (Anthropic) — recommended</option>
              <option value="openai">OpenAI (GPT-4o mini)</option>
            </select>
            <div class="lia-label">API Key</div>
            <input type="password" id="lia-settings-key" class="lia-input" placeholder="sk-ant-... or sk-...">
            <button class="lia-btn" id="lia-settings-save-key" style="background:#7c3aed;color:white;margin-top:6px;font-size:11px">Save API Key</button>
            <div id="lia-settings-key-saved" style="display:none;color:#16a34a;font-size:11px;text-align:center;margin-top:4px">✅ Saved!</div>
            <p style="font-size:10px;margin-top:6px">
              <a href="https://console.anthropic.com/keys" target="_blank" style="color:#7c3aed">Get Claude key →</a>
              &nbsp;·&nbsp;
              <a href="https://platform.openai.com/api-keys" target="_blank" style="color:#7c3aed">Get OpenAI key →</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  const fab = document.createElement('div');
  fab.id = 'lia-collapsed';
  fab.title = 'Open OutreachAI';
  fab.innerHTML = '💼';
  fab.style.display = 'none';

  document.body.appendChild(panel);
  document.body.appendChild(fab);

  // ─── Tab switching ───────────────────────────────────────────────────────────
  panel.querySelectorAll('.lia-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.lia-tab').forEach(t => t.classList.remove('active'));
      panel.querySelectorAll('.lia-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'tracker') renderContacts();
      if (tab.dataset.tab === 'templates') renderTemplateEditForm();
      if (tab.dataset.tab === 'posts') updatePostsTab();
      if (tab.dataset.tab === 'settings') renderSettingsTab();
    });
  });

  // ─── Contacts list: event delegation (fixes isolated-world onclick bug) ──────
  document.getElementById('lia-contacts-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const profileId = btn.dataset.pid;
    const action = btn.dataset.action;
    if (action === 'mark-replied') {
      const contacts = await getContacts();
      if (contacts[profileId]) {
        contacts[profileId].status = 'replied';
        await saveContacts(contacts);
        renderContacts();
      }
    } else if (action === 'delete-contact') {
      const contacts = await getContacts();
      delete contacts[profileId];
      await saveContacts(contacts);
      safeAlarmClear(`followup_${profileId}`);
      renderContacts();
    }
  });

  // ─── Collapse / expand ───────────────────────────────────────────────────────
  document.getElementById('lia-toggle').addEventListener('click', () => {
    panel.style.display = 'none';
    fab.style.display = 'flex';
  });
  fab.addEventListener('click', () => {
    panel.style.display = '';
    fab.style.display = 'none';
    updateProfileInfo();
  });

  // ─── Draggable panel ─────────────────────────────────────────────────────────
  let drag = false, ox = 0, oy = 0;
  const header = document.getElementById('lia-header');
  header.addEventListener('mousedown', e => {
    drag = true;
    ox = e.clientX - panel.getBoundingClientRect().left;
    oy = e.clientY - panel.getBoundingClientRect().top;
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.left = (e.clientX - ox) + 'px';
    panel.style.top = (e.clientY - oy) + 'px';
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { drag = false; });

  // ─── Variable chips ──────────────────────────────────────────────────────────
  panel.querySelectorAll('.lia-var-chip[data-var]').forEach(chip => {
    chip.addEventListener('click', () => {
      const ta = document.getElementById('lia-template-preview');
      const start = ta.selectionStart, end = ta.selectionEnd;
      const val = ta.value;
      ta.value = val.slice(0, start) + chip.dataset.var + val.slice(end);
      ta.selectionStart = ta.selectionEnd = start + chip.dataset.var.length;
      ta.focus();
    });
  });

  panel.querySelectorAll('.lia-var-chip[data-var2]').forEach(chip => {
    chip.addEventListener('click', () => {
      const ta = document.getElementById('lia-template-body');
      const start = ta.selectionStart;
      const val = ta.value;
      ta.value = val.slice(0, start) + chip.dataset.var2 + val.slice(start);
      ta.selectionStart = ta.selectionEnd = start + chip.dataset.var2.length;
      ta.focus();
    });
  });

  // ─── Posts tab: update activity link + dashboard link ────────────────────────
  function updatePostsTab() {
    const profile = getProfileData();
    const profileId = profile.profileId ||
      window.location.pathname.split('/in/')[1]?.split('/')[0] || '';

    // Activity link
    const activityLinkEl = document.getElementById('lia-activity-link-text');
    if (activityLinkEl && profileId) {
      activityLinkEl.onclick = () => {
        window.open(`https://www.linkedin.com/in/${profileId}/recent-activity/shares/`, '_blank');
      };
    }

    // Dashboard link
    const dashLinkEl = document.getElementById('lia-dashboard-posts-link');
    if (dashLinkEl) {
      safeStorageGet('dashUrl').then(({ dashUrl }) => {
        if (dashUrl) {
          dashLinkEl.setAttribute('href', `${dashUrl}/captured-posts`);
        }
      });
    }
  }

  // ─── Capture posts button ─────────────────────────────────────────────────────
  document.getElementById('lia-capture-posts-btn').addEventListener('click', captureAndSavePosts);

  // ─── Template select change ──────────────────────────────────────────────────
  document.getElementById('lia-template-select').addEventListener('change', loadSelectedTemplate);

  // ─── AI Personalize button ───────────────────────────────────────────────────
  document.getElementById('lia-ai-btn').addEventListener('click', async () => {
    const profile = getProfileData();
    if (!profile.isProfile && !profile.firstName) {
      showStatus('Open a LinkedIn profile or messaging thread first.', 'error');
      return;
    }

    const aiStatus = document.getElementById('lia-ai-status');
    const btn = document.getElementById('lia-ai-btn');
    btn.disabled = true;
    btn.textContent = '✨ Generating...';
    aiStatus.textContent = 'Reading profile & writing personalized line...';
    aiStatus.style.color = '#7c3aed';
    aiStatus.style.display = 'block';

    const { dashToken, dashUrl, aiApiKey, aiProvider } = await safeStorageGet(['dashToken', 'dashUrl', 'aiApiKey', 'aiProvider']);

    let responseText = null;
    let errorMsg = null;

    if (dashToken && dashUrl) {
      // Use dashboard AI (no separate key needed — uses the key saved in Settings)
      try {
        const res = await fetch(`${dashUrl}/api/extension/personalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dashToken}` },
          body: JSON.stringify({
            name: profile.name,
            headline: profile.headline,
            company: profile.company,
            about: profile.about,
            recentPost: profile.recentPost,
          }),
        });
        const data = await res.json();
        if (res.ok && data.text) {
          responseText = data.text;
        } else {
          errorMsg = data.error || 'AI generation failed';
        }
      } catch {
        errorMsg = 'Network error — check dashboard connection';
      }
    } else if (aiApiKey) {
      // Fallback: use locally-saved API key via background script
      const response = await safeRuntimeSendMessage({
        type: 'AI_PERSONALIZE',
        profile,
        apiKey: aiApiKey,
        provider: aiProvider || 'claude',
      });
      if (response?.ok) {
        responseText = response.text;
      } else {
        errorMsg = response?.error || 'API error — check your key';
      }
    } else {
      // No key — auto-switch to Settings tab so user can add key inline
      const settingsTab = panel.querySelector('[data-tab="settings"]');
      if (settingsTab) settingsTab.click();
      btn.disabled = false;
      btn.textContent = '✨ AI Personalize First Line';
      aiStatus.textContent = '⚠️ Add your API key in the Settings tab above.';
      aiStatus.style.color = '#d97706';
      aiStatus.style.display = 'block';
      setTimeout(() => { aiStatus.style.display = 'none'; }, 5000);
      return;
    }

    btn.disabled = false;
    btn.textContent = '✨ AI Personalize First Line';

    if (errorMsg) {
      aiStatus.textContent = '';
      aiStatus.style.color = '#dc2626';
      if (errorMsg.includes('Settings')) {
        aiStatus.appendChild(document.createTextNode('❌ API key not configured. '));
        const link = document.createElement('a');
        link.href = 'https://outreachai.in/settings';
        link.target = '_blank';
        link.style.cssText = 'color:#7c3aed;text-decoration:underline;cursor:pointer';
        link.textContent = 'Add it in Dashboard → Settings → AI Providers';
        aiStatus.appendChild(link);
      } else {
        aiStatus.textContent = '❌ ' + errorMsg;
      }
      return;
    }

    // Replace first line of the preview with AI-generated opener
    const ta = document.getElementById('lia-template-preview');
    const lines = ta.value.split('\n');
    lines[0] = responseText;
    ta.value = lines.join('\n');

    aiStatus.textContent = '✅ Personalized! Refine below or proceed.';
    aiStatus.style.color = '#16a34a';

    // Show AI chat pane for tone refinement
    const chatPane = document.getElementById('lia-ai-chat');
    if (chatPane) {
      chatPane.style.display = 'block';
      document.getElementById('lia-ai-context').value = '';
      panel.querySelectorAll('.lia-tone-chip').forEach(c => c.classList.remove('lia-tone-active'));
    }
  });

  // ─── AI tone chips ────────────────────────────────────────────────────────────
  panel.querySelectorAll('.lia-tone-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.lia-tone-chip').forEach(c => c.classList.remove('lia-tone-active'));
      chip.classList.add('lia-tone-active');
      const ctx = document.getElementById('lia-ai-context');
      ctx.value = `Rewrite in a ${chip.dataset.tone.toLowerCase()} tone`;
    });
  });

  // ─── AI Regenerate button ─────────────────────────────────────────────────────
  document.getElementById('lia-ai-regen').addEventListener('click', async () => {
    const profile = getProfileData();
    const instruction = document.getElementById('lia-ai-context').value.trim();
    const regenBtn = document.getElementById('lia-ai-regen');
    regenBtn.disabled = true;
    regenBtn.textContent = '⏳';

    const { dashToken, dashUrl, aiApiKey, aiProvider } = await safeStorageGet(['dashToken', 'dashUrl', 'aiApiKey', 'aiProvider']);
    let responseText = null;

    if (dashToken && dashUrl) {
      try {
        const res = await fetch(`${dashUrl}/api/extension/personalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dashToken}` },
          body: JSON.stringify({ name: profile.name, headline: profile.headline, company: profile.company, about: profile.about, recentPost: profile.recentPost, instruction }),
        });
        const data = await res.json();
        if (res.ok && data.text) responseText = data.text;
      } catch {}
    } else if (aiApiKey) {
      const response = await safeRuntimeSendMessage({ type: 'AI_PERSONALIZE', profile, apiKey: aiApiKey, provider: aiProvider || 'claude', instruction });
      if (response?.ok) responseText = response.text;
    }

    regenBtn.disabled = false;
    regenBtn.textContent = '↺ Regenerate';

    if (responseText) {
      const ta = document.getElementById('lia-template-preview');
      const lines = ta.value.split('\n');
      lines[0] = responseText;
      ta.value = lines.join('\n');
    }
  });

  // ─── AI chat "Done" button ────────────────────────────────────────────────────
  document.getElementById('lia-ai-use').addEventListener('click', () => {
    const chatPane = document.getElementById('lia-ai-chat');
    if (chatPane) chatPane.style.display = 'none';
    const aiStatus = document.getElementById('lia-ai-status');
    if (aiStatus) aiStatus.style.display = 'none';
  });

  // ─── Fill message button ─────────────────────────────────────────────────────
  document.getElementById('lia-fill-btn').addEventListener('click', () => {
    const text = document.getElementById('lia-template-preview').value;
    fillMessageBox(text);
  });

  // ─── Log as Sent ─────────────────────────────────────────────────────────────
  document.getElementById('lia-track-btn').addEventListener('click', async () => {
    const profile = getProfileData();
    if (!profile.profileId && !profile.name) {
      showStatus('Visit a LinkedIn profile or messaging thread first.', 'error');
      return;
    }
    const days = parseInt(document.getElementById('lia-followup-days').value) || 3;
    const followupAt = Date.now() + days * 24 * 60 * 60 * 1000;

    // Always save locally first (works offline)
    const contacts = await getContacts();
    contacts[profile.profileId] = {
      profileId: profile.profileId,
      name: profile.name,
      company: profile.company,
      headline: profile.headline,
      sentAt: Date.now(),
      followupAt,
      status: 'followup'
    };
    await saveContacts(contacts);
    await scheduleFollowUp(profile.profileId, days);

    // If connected to dashboard, also sync to API
    const { dashToken, dashUrl } = await safeStorageGet(['dashToken', 'dashUrl']);
    if (dashToken && dashUrl) {
      try {
        const res = await fetch(`${dashUrl}/api/contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${dashToken}`,
          },
          body: JSON.stringify({
            profileId:    profile.profileId,
            name:         profile.name,
            company:      profile.company,
            headline:     profile.headline,
            linkedinUrl:  `https://www.linkedin.com/in/${profile.profileId}`,
            about:        profile.about || null,
            recentPost:   profile.recentPost || null,
            status:       'followup',
            sentAt:       new Date().toISOString(),
            followupAt:   new Date(followupAt).toISOString(),
          }),
        });
        if (res.ok) {
          showStatus(`Logged + synced to dashboard ✓ Follow-up in ${days} days.`, 'success');
        } else {
          showStatus(`Logged locally — dashboard sync failed. Follow-up in ${days} days.`, 'success');
        }
      } catch {
        showStatus(`Logged locally — couldn't reach dashboard. Follow-up in ${days} days.`, 'success');
      }
      return;
    }

    showStatus(`Logged locally. Follow-up in ${days} days.`, 'success');
  });

  // ─── Add to Lead List button ─────────────────────────────────────────────────
  document.getElementById('lia-add-lead-btn').addEventListener('click', async () => {
    const profile = getProfileData();
    if (!profile.firstName) {
      showStatus('Could not detect a person — try visiting their profile page.', 'error');
      return;
    }

    const { dashToken, dashUrl } = await safeStorageGet(['dashToken', 'dashUrl']);
    if (!dashToken || !dashUrl) {
      showStatus('Connect to OutreachAI dashboard in the extension popup first.', 'error');
      return;
    }

    const btn = document.getElementById('lia-add-lead-btn');
    const statusEl = document.getElementById('lia-add-lead-status');
    btn.disabled = true;
    btn.textContent = '⏳ Adding & generating opener...';
    statusEl.textContent = 'Reading profile data & writing personalized opener with AI...';
    statusEl.style.display = 'block';
    statusEl.style.color = '#7c3aed';

    try {
      const res = await fetch(`${dashUrl}/api/leads/enrich-from-extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dashToken}`,
        },
        body: JSON.stringify({
          profileId:    profile.profileId,
          firstName:    profile.firstName,
          lastName:     profile.lastName || '',
          headline:     profile.headline || '',
          company:      profile.company || '',
          linkedinUrl:  `https://www.linkedin.com/in/${profile.profileId}`,
          aboutSection: profile.about || '',
          recentPosts:  profile.recentPosts || [],
          skills:       profile.skills || [],
          location:     profile.location || '',
          seniority:    profile.seniority || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const opener = data.aiOpener;
        const action = data.isNew ? 'Added' : 'Updated';

        statusEl.textContent = `✅ ${action} in "Chrome Extension Leads"`;
        statusEl.style.color = '#16a34a';

        // If opener generated, offer to fill it in the compose box
        if (opener) {
          const ta = document.getElementById('lia-template-preview');
          const lines = ta.value.split('\n');
          lines[0] = opener;
          ta.value = lines.join('\n');
          statusEl.textContent += ' · AI opener filled above ✨';
        }
      } else {
        const err = await res.json().catch(() => ({}));
        statusEl.textContent = '❌ ' + (err.error || 'Failed to add lead');
        statusEl.style.color = '#dc2626';
      }
    } catch (e) {
      statusEl.textContent = '❌ Network error — check dashboard connection';
      statusEl.style.color = '#dc2626';
    }

    btn.disabled = false;
    btn.textContent = '⬆️ Add to Lead List + AI Opener';
    setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
  });

  // ─── Template editor ─────────────────────────────────────────────────────────
  async function renderTemplateEditForm() {
    const templates = await getTemplates();
    const sel = document.getElementById('lia-edit-select');
    sel.innerHTML = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    loadEditTemplate();
  }

  function loadEditTemplate() {
    getTemplates().then(templates => {
      const sel = document.getElementById('lia-edit-select');
      const tmpl = templates.find(t => t.id === sel.value) || templates[0];
      if (!tmpl) return;
      document.getElementById('lia-template-name').value = tmpl.name;
      document.getElementById('lia-template-body').value = tmpl.message;
    });
  }

  document.getElementById('lia-edit-select').addEventListener('change', loadEditTemplate);

  document.getElementById('lia-save-tmpl').addEventListener('click', async () => {
    const templates = await getTemplates();
    const sel = document.getElementById('lia-edit-select');
    const idx = templates.findIndex(t => t.id === sel.value);
    if (idx === -1) return;
    templates[idx].name = document.getElementById('lia-template-name').value;
    templates[idx].message = document.getElementById('lia-template-body').value;
    await saveTemplates(templates);
    showStatus('Template saved!', 'success');
    renderTemplateEditor();
    renderTemplateEditForm();
  });

  document.getElementById('lia-new-tmpl').addEventListener('click', async () => {
    const templates = await getTemplates();
    const newId = 't' + Date.now();
    templates.push({ id: newId, name: 'New Template', message: 'Hi {{firstName}},\n\n' });
    await saveTemplates(templates);
    renderTemplateEditor();
    renderTemplateEditForm().then(() => {
      document.getElementById('lia-edit-select').value = newId;
      loadEditTemplate();
    });
  });

  // ─── Settings tab ────────────────────────────────────────────────────────────
  async function renderSettingsTab() {
    const { dashToken, dashEmail, aiProvider, aiApiKey } = await safeStorageGet(['dashToken', 'dashEmail', 'aiProvider', 'aiApiKey']);
    const connEl = document.getElementById('lia-settings-connected');
    const loginEl = document.getElementById('lia-settings-login');
    const emailDisp = document.getElementById('lia-settings-email-display');
    const dashNote = document.getElementById('lia-settings-ai-dash-note');
    const aiLocal = document.getElementById('lia-settings-ai-local');

    if (dashToken) {
      if (connEl) connEl.style.display = 'block';
      if (loginEl) loginEl.style.display = 'none';
      if (emailDisp) emailDisp.textContent = dashEmail || '';
      if (dashNote) dashNote.style.display = 'block';
      if (aiLocal) aiLocal.style.display = 'none';
    } else {
      if (connEl) connEl.style.display = 'none';
      if (loginEl) loginEl.style.display = 'block';
      if (dashNote) dashNote.style.display = 'none';
      if (aiLocal) aiLocal.style.display = 'block';
    }
    if (aiProvider) {
      const sel = document.getElementById('lia-settings-provider');
      if (sel) sel.value = aiProvider;
    }
    if (aiApiKey) {
      const keyEl = document.getElementById('lia-settings-key');
      if (keyEl) keyEl.value = aiApiKey;
    }
  }

  document.getElementById('lia-settings-connect').addEventListener('click', async () => {
    const email = document.getElementById('lia-settings-email-input')?.value.trim();
    const password = document.getElementById('lia-settings-password-input')?.value;
    const errEl = document.getElementById('lia-settings-login-error');
    const btn = document.getElementById('lia-settings-connect');
    if (errEl) errEl.style.display = 'none';
    if (!email || !password) {
      if (errEl) { errEl.textContent = 'Enter email and password'; errEl.style.display = 'block'; }
      return;
    }
    btn.textContent = 'Connecting…'; btn.disabled = true;
    try {
      const res = await fetch('https://outreachai.in/api/extension/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        if (errEl) { errEl.textContent = data.error || 'Invalid email or password'; errEl.style.display = 'block'; }
        return;
      }
      await safeStorageSet({ dashToken: data.token, dashEmail: email, dashPlan: data.plan || 'free', dashUrl: 'https://outreachai.in' });
      // Update UI directly — don't re-read storage (avoids context/timing issues)
      const connEl = document.getElementById('lia-settings-connected');
      const loginEl = document.getElementById('lia-settings-login');
      const emailDisp = document.getElementById('lia-settings-email-display');
      const dashNote = document.getElementById('lia-settings-ai-dash-note');
      const aiLocal = document.getElementById('lia-settings-ai-local');
      if (connEl) connEl.style.display = 'block';
      if (loginEl) loginEl.style.display = 'none';
      if (emailDisp) emailDisp.textContent = email;
      if (dashNote) dashNote.style.display = 'block';
      if (aiLocal) aiLocal.style.display = 'none';
    } catch {
      if (errEl) { errEl.textContent = 'Could not reach dashboard'; errEl.style.display = 'block'; }
    } finally {
      btn.textContent = 'Connect'; btn.disabled = false;
    }
  });

  document.getElementById('lia-settings-disconnect').addEventListener('click', async () => {
    if (!isContextValid()) return;
    try { await chrome.storage.local.remove(['dashToken', 'dashEmail', 'dashPlan']); } catch {}
    renderSettingsTab();
  });

  document.getElementById('lia-settings-save-key').addEventListener('click', async () => {
    const provider = document.getElementById('lia-settings-provider')?.value;
    const key = document.getElementById('lia-settings-key')?.value.trim();
    if (!key) return;
    safeStorageSet({ aiProvider: provider, aiApiKey: key }); // fire-and-forget; show feedback immediately
    const saved = document.getElementById('lia-settings-key-saved');
    if (saved) { saved.style.display = 'block'; setTimeout(() => { saved.style.display = 'none'; }, 2000); }
  });

  // ─── Safe DOM helper — never interpolate user data into innerHTML ────────────
  function setProfileBox(box, profile) {
    box.textContent = '';

    // Name
    const strong = document.createElement('strong');
    strong.textContent = profile.name;
    box.appendChild(strong);
    box.appendChild(document.createElement('br'));

    // Headline
    if (profile.headline) {
      const span = document.createElement('span');
      span.style.cssText = 'font-size:11px;color:#555;display:block;margin-top:1px';
      span.textContent = profile.headline;
      box.appendChild(span);
    }

    // Data signals row
    const signals = [];
    if (profile.about) signals.push('📝 About');
    if (profile.recentPosts && profile.recentPosts.length > 0) signals.push(`📣 ${profile.recentPosts.length} post${profile.recentPosts.length > 1 ? 's' : ''}`);
    if (profile.skills && profile.skills.length > 0) signals.push(`🔧 ${profile.skills.length} skills`);

    if (signals.length > 0) {
      const sigRow = document.createElement('div');
      sigRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:5px';
      signals.forEach(sig => {
        const chip = document.createElement('span');
        chip.style.cssText = 'font-size:10px;background:#ede9fe;color:#7c3aed;padding:1px 6px;border-radius:10px;font-weight:600';
        chip.textContent = sig;
        sigRow.appendChild(chip);
      });
      box.appendChild(sigRow);
    }
  }

  // ─── Warn variable chips that couldn't be extracted ─────────────────────────
  function updateVariableChips(profile) {
    const map = { firstName: profile.firstName, lastName: profile.lastName, company: profile.company, headline: profile.headline, name: profile.name };
    panel.querySelectorAll('.lia-var-chip').forEach(chip => {
      const key = (chip.dataset.var || chip.dataset.var2 || '').replace(/[{}]/g, '');
      if (!key) return;
      const missing = !map[key];
      chip.style.background = missing ? '#fef3c7' : '';
      chip.style.color = missing ? '#b45309' : '';
      chip.title = missing ? `${key} not found on this profile` : '';
    });
  }

  // ─── Update profile info box ─────────────────────────────────────────────────
  function updateProfileInfo(retries = 8) {
    const profile = getProfileData();
    const box = document.getElementById('lia-profile-info');
    if (!box) return;

    if (profile.name) {
      setProfileBox(box, profile);
      loadSelectedTemplate();
      updateVariableChips(profile);
    } else if (retries > 0) {
      const onProfileOrThread =
        window.location.href.includes('/in/') ||
        window.location.href.includes('/messaging/thread/');
      if (onProfileOrThread) {
        box.textContent = 'Loading profile...';
        // Increase delay on later retries to handle slow React renders
        const delay = retries > 4 ? 600 : 1200;
        setTimeout(() => updateProfileInfo(retries - 1), delay);
      } else {
        box.textContent = 'Open a LinkedIn profile or message thread to auto-fill.';
        loadSelectedTemplate();
      }
    } else {
      // All retries exhausted — only use title fallback on actual profile pages
      const onProfilePage = window.location.href.includes('/in/');
      const titleName = onProfilePage && document.title.includes('| LinkedIn')
        ? document.title.split('|')[0].trim().replace(/\s*\([^)]*\)\s*$/, '').trim()
        : '';
      if (titleName && titleName.toLowerCase() !== 'feed' && titleName.toLowerCase() !== 'linkedin') {
        const fallbackProfile = {
          name: titleName,
          firstName: titleName.split(' ')[0],
          lastName: titleName.split(' ').slice(1).join(' '),
          headline: '', company: '', about: '',
          recentPosts: [], skills: [], location: '', seniority: '',
          profileId: window.location.href.split('/in/')[1]?.split('/')[0] || '',
          isProfile: true,
        };
        setProfileBox(box, fallbackProfile);
        loadSelectedTemplate();
      } else {
        box.textContent = 'Open a LinkedIn profile or message thread to auto-fill.';
        loadSelectedTemplate();
      }
    }
  }

  // ─── Debounce maps — prevent API spam on high-frequency DOM mutations ─────────
  const _replyDetectionLastRun = new Map();
  const _inboxSyncLastRun = { ts: 0 };
  const REPLY_COOLDOWN_MS = 10_000;
  const INBOX_COOLDOWN_MS = 15_000;

  // ─── Reply detection (linkedin.com/messaging/thread/*) ───────────────────────
  async function detectReplyInThread() {
    if (!isContextValid()) return;

    const key = location.pathname;
    if (Date.now() - (_replyDetectionLastRun.get(key) || 0) < REPLY_COOLDOWN_MS) return;
    _replyDetectionLastRun.set(key, Date.now());

    const { dashToken, dashUrl } = await safeStorageGet(['dashToken', 'dashUrl']);
    if (!dashToken || !dashUrl) return;

    const threadMatch = location.pathname.match(/\/messaging\/thread\/([^/]+)/);
    if (!threadMatch) return;

    const msgContainers = document.querySelectorAll(
      '.msg-s-message-list__event, .msg-s-event-listitem'
    );
    if (msgContainers.length === 0) return;

    const lastMsg = msgContainers[msgContainers.length - 1];

    // Outgoing = the last bubble has an outgoing-group descendant.
    // The old code had `classList.contains(...) === false` which was always true
    // when the class was absent — this is the corrected single-check version.
    const isOutgoing =
      lastMsg.querySelector('.msg-s-message-group--outgoing') !== null ||
      lastMsg.querySelector('[class*="msg-s-message-group--outgoing"]') !== null;

    if (isOutgoing) return; // we sent the last message

    // Extract profileId from conversation header link
    const profileLink = document.querySelector(
      '.msg-thread__top-actions-bar a[href*="/in/"], ' +
      'a.app-aware-link[href*="linkedin.com/in/"]'
    );
    let profileId = threadMatch[1]; // fallback to LinkedIn thread ID
    if (profileLink) {
      const m = profileLink.getAttribute('href')?.match(/\/in\/([^/?]+)/);
      if (m) profileId = m[1];
    }

    try {
      await fetch(`${dashUrl}/api/contacts/by-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dashToken}` },
        body: JSON.stringify({ profileId, status: 'replied' }),
      });
    } catch { /* network errors are non-fatal */ }
  }

  // ─── Inbox sync (linkedin.com/messaging) ─────────────────────────────────────
  async function syncInbox() {
    if (!isContextValid()) return;
    if (!location.pathname.startsWith('/messaging')) return;
    if (Date.now() - _inboxSyncLastRun.ts < INBOX_COOLDOWN_MS) return;
    _inboxSyncLastRun.ts = Date.now();
    const { dashToken, dashUrl } = await safeStorageGet(['dashToken', 'dashUrl']);
    if (!dashToken || !dashUrl) return;

    // Scrape conversation list items
    const convItems = document.querySelectorAll(
      '.msg-conversation-listitem, .msg-conversations-container__convo-item'
    );
    if (convItems.length === 0) return;

    const threads = [];
    for (const item of convItems) {
      // Participant name
      const nameEl = item.querySelector('.msg-conversation-listitem__participant-names, .conversation-list-item__title');
      const name = nameEl ? nameEl.innerText.trim() : '';
      if (!name) continue;

      // Profile URL
      const linkEl = item.querySelector('a[href*="/in/"]');
      const profileUrl = linkEl ? linkEl.getAttribute('href') : null;
      const profileMatch = profileUrl?.match(/\/in\/([^/?]+)/);
      const profileId = profileMatch ? profileMatch[1] : name.toLowerCase().replace(/\s+/g, '-');

      // Avatar
      const avatarEl = item.querySelector('img.msg-selectable-entity__img, img.presence-entity__image');
      const avatarUrl = avatarEl ? avatarEl.getAttribute('src') : null;

      // Last message snippet
      const snippetEl = item.querySelector('.msg-conversation-listitem__message-snippet, .conversation-list-item__message');
      const lastMessage = snippetEl ? snippetEl.innerText.trim() : '';

      // Unread indicator
      const unread = item.querySelector('.msg-conversation-listitem__unread-count, [class*="unread"]') !== null;

      // Determine last sender: LinkedIn marks unread (from them) vs read (last msg was ours)
      // Heuristic: if item has unread badge, prospect sent last message
      const lastSenderIsMe = !unread;

      threads.push({ profileId, participantName: name, participantUrl: profileUrl, avatarUrl, lastMessage, lastSenderIsMe, unread });
    }

    if (threads.length === 0) return;

    try {
      await fetch(`${dashUrl}/api/inbox/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dashToken}`,
        },
        body: JSON.stringify({ threads }),
      });
    } catch { /* non-fatal */ }
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  updateProfileInfo();
  renderTemplateEditor();

  // Re-detect profile on navigation (LinkedIn is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(updateProfileInfo, 1500);

      // Reply detection + profile info on thread pages
      if (location.pathname.includes('/messaging/thread/')) {
        setTimeout(detectReplyInThread, 2000);
        setTimeout(updateProfileInfo, 2000);
      }

      // Inbox sync on messaging list
      if (location.pathname === '/messaging/' || location.pathname === '/messaging') {
        setTimeout(syncInbox, 2500);
      }
    }
  }).observe(document, { subtree: true, childList: true });

  // Run inbox sync once on initial load if already on messaging page
  if (location.pathname.startsWith('/messaging')) {
    setTimeout(syncInbox, 3000);
  }
  if (location.pathname.includes('/messaging/thread/')) {
    setTimeout(detectReplyInThread, 3000);
    setTimeout(updateProfileInfo, 2500);
  }

})();
