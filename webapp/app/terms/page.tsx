export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 font-sans text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 21, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
        <p className="leading-relaxed">By accessing or using OutReachAI (&ldquo;the Service&rdquo;) at outreachai.in, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
        <p className="leading-relaxed">OutReachAI provides an AI-powered LinkedIn outreach platform including a web dashboard, Chrome extension, email campaign tooling, and an MCP (Model Context Protocol) server for AI agent integrations. We reserve the right to modify or discontinue any part of the Service at any time.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Account Responsibilities</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You must be at least 18 years old to use the Service.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You must notify us immediately at outreachai.in@gmail.com of any unauthorized use of your account.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
        <p className="leading-relaxed mb-3">You agree not to use the Service to:</p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>Send spam, unsolicited bulk messages, or violate LinkedIn&apos;s Terms of Service.</li>
          <li>Scrape, harvest, or collect data from LinkedIn beyond what you personally view.</li>
          <li>Upload or transmit malicious code, viruses, or harmful content.</li>
          <li>Impersonate any person or entity.</li>
          <li>Use the Service for any illegal purpose or in violation of any applicable laws.</li>
          <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. LinkedIn Compliance</h2>
        <p className="leading-relaxed">OutReachAI is designed to operate within LinkedIn&apos;s usage policies. We do not automate clicks or bypass LinkedIn&apos;s controls. You are solely responsible for ensuring your outreach activities comply with LinkedIn&apos;s User Agreement. OutReachAI is not affiliated with LinkedIn Corporation.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. AI and API Keys</h2>
        <p className="leading-relaxed">The Service supports &ldquo;bring your own key&rdquo; (BYOK) for AI providers (Anthropic, OpenAI, Google). Your API keys are stored encrypted on our servers solely to power AI features on your behalf. You are responsible for your API usage and associated costs with third-party AI providers.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. MCP Server</h2>
        <p className="leading-relaxed">Access to the OutReachAI MCP server is provided as part of the Service. Your MCP bearer token is personal and must not be shared. You are responsible for all actions taken via your MCP token. We reserve the right to revoke MCP access if misuse is detected.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
        <p className="leading-relaxed">All content, features, and functionality of the Service — including but not limited to text, graphics, logos, and code — are the exclusive property of OutReachAI and are protected by applicable intellectual property laws. You retain ownership of all data you upload to the Service.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Disclaimer of Warranties</h2>
        <p className="leading-relaxed">The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
        <p className="leading-relaxed">To the maximum extent permitted by law, OutReachAI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to loss of profits, data, or business opportunities.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">11. Termination</h2>
        <p className="leading-relaxed">We may suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time from Settings. Upon termination, your right to use the Service ceases immediately.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
        <p className="leading-relaxed">These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka, India.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">13. Contact</h2>
        <p className="leading-relaxed">Questions about these Terms? Email us at <a href="mailto:outreachai.in@gmail.com" className="text-blue-600 underline">outreachai.in@gmail.com</a>.</p>
      </section>
    </div>
  )
}
