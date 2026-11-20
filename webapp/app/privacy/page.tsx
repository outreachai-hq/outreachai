export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 font-sans text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 21, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Overview</h2>
        <p className="leading-relaxed">OutReachAI (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) operates outreachai.in and the OutreachAI for LinkedIn Chrome extension. This policy explains what data we collect, how we use it, and your rights.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li><strong>Account data:</strong> Name, email address, and hashed password when you sign up.</li>
          <li><strong>LinkedIn prospect data:</strong> Name, headline, company, and LinkedIn URL of contacts you choose to save via the Chrome extension.</li>
          <li><strong>Email credentials:</strong> SMTP/IMAP credentials you optionally connect for outreach campaigns. Passwords are encrypted at rest using AES-256-GCM.</li>
          <li><strong>Usage data:</strong> Campaign activity, sent messages, and reply status for your own analytics dashboard.</li>
          <li><strong>Extension storage:</strong> Your login token and AI API key are stored locally in your browser via <code>chrome.storage.local</code> and never transmitted to our servers.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. How We Use Your Data</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>To provide and operate the OutReachAI service.</li>
          <li>To sync LinkedIn contacts you explicitly save to your dashboard.</li>
          <li>To send outreach emails on your behalf using your connected email account.</li>
          <li>To send transactional emails (e.g. password reset) via Resend.</li>
          <li>We do <strong>not</strong> sell, rent, or share your data with third parties for marketing purposes.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Chrome Extension — Data Practices</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>The extension reads LinkedIn profile pages only when you are actively viewing them.</li>
          <li>No keystrokes, mouse activity, or browsing history is collected.</li>
          <li>AI personalization calls are made directly from your browser to Anthropic or OpenAI using your own API key — we never see your AI API key on our servers.</li>
          <li>Contact data is only synced to your OutReachAI dashboard when you explicitly click <em>&ldquo;Log as Sent&rdquo;</em>.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data Storage & Security</h2>
        <p className="leading-relaxed">Your data is stored in a PostgreSQL database hosted on Neon (AWS ap-southeast-1). Email passwords are encrypted using AES-256-GCM before storage. We use HTTPS for all data in transit.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Data Retention & Deletion</h2>
        <p className="leading-relaxed">You can delete your account and all associated data at any time from Settings. Upon deletion, all your data is permanently removed from our systems within 30 days.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Third-Party Services</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li><strong>Neon</strong> — PostgreSQL database hosting</li>
          <li><strong>Vercel</strong> — Application hosting</li>
          <li><strong>Resend</strong> — Transactional email delivery</li>
          <li><strong>Anthropic / OpenAI</strong> — AI personalization (via your own API key, client-side only)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Contact</h2>
        <p className="leading-relaxed">For privacy questions or data deletion requests, email us at <a href="mailto:outreachai.in@gmail.com" className="text-blue-600 underline">outreachai.in@gmail.com</a>.</p>
      </section>
    </div>
  )
}
