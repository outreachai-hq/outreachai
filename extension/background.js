// Background service worker — handles follow-up alarms, notifications, and AI API calls

// ─── Open welcome page on first install ──────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://outreachai.in/welcome-extension' })
  }
})

// ─── AI Personalization ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'AI_PERSONALIZE') return false;

  (async () => {
    const { profile, apiKey, provider, instruction } = msg;

    const baseContext = `Name: ${profile.name}\nRole: ${profile.headline}\nCompany: ${profile.company}\nAbout: ${profile.about || 'Not available'}\nRecent post: ${profile.recentPost || 'Not available'}`;

    const prompt = instruction
      ? `You are a LinkedIn outreach copywriter. ${instruction}. Apply this to the opening sentence of a cold outreach to:\n\n${baseContext}\n\nOutput ONLY the revised single sentence (max 25 words), nothing else.`
      : `You are a LinkedIn outreach expert. Write ONLY a single personalized opening sentence (max 25 words) for a cold outreach message to this person:\n\n${baseContext}\n\nRules:\n- Reference something SPECIFIC from their role, company, or about section\n- Sound human and warm, not salesy\n- Do NOT start with "I" or "Hi"\n- No generic phrases like "impressed by your profile"\n- Output ONLY the sentence, nothing else`;

    try {
      let text = '';

      if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 80,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        text = data.content[0].text.trim();
      } else {
        // OpenAI
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 80,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        text = data.choices[0].message.content.trim();
      }

      sendResponse({ ok: true, text });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true; // keep message channel open for async response
});


chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('followup_')) return;

  const profileId = alarm.name.replace('followup_', '');
  const data = await chrome.storage.local.get('contacts');
  const contacts = data.contacts || {};
  const contact = contacts[profileId];

  if (!contact) return;

  chrome.notifications.create(`notif_${profileId}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Follow-up Reminder',
    message: `Time to follow up with ${contact.name} at ${contact.company || 'their company'}`,
    buttons: [{ title: 'Open LinkedIn' }],
    priority: 2
  });
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {
  if (btnIndex === 0 && notifId.startsWith('notif_')) {
    const profileId = notifId.replace('notif_', '');
    chrome.tabs.create({ url: `https://www.linkedin.com/in/${profileId}/` });
  }
});
