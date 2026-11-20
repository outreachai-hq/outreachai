import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: 'OutreachAI — Free Lemlist & HubSpot Alternative', template: '%s | OutreachAI' },
  description: 'AI-powered outreach sequences, CRM pipeline, workflow automation and LinkedIn automation — all in one free platform. The Lemlist + HubSpot alternative.',
  keywords: ['lemlist alternative', 'hubspot alternative', 'linkedin outreach', 'cold email software', 'sales automation', 'crm free'],
  authors: [{ name: 'OutreachAI' }],
  creator: 'OutreachAI',
  metadataBase: new URL('https://outreachai.in'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://outreachai.in',
    siteName: 'OutreachAI',
    title: 'OutreachAI — Free Lemlist & HubSpot Alternative',
    description: 'AI outreach sequences, CRM pipeline, workflows and LinkedIn automation. Free during beta.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OutreachAI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OutreachAI — Free Lemlist & HubSpot Alternative',
    description: 'AI outreach sequences, CRM pipeline, workflows and LinkedIn automation. Free during beta.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Dark mode — runs before paint to prevent white flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();` }} />
        {/* Global JSON-LD — Organization + SoftwareApplication schema for AI/SEO */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': 'https://outreachai.in/#org',
              name: 'OutreachAI',
              url: 'https://outreachai.in',
              logo: 'https://outreachai.in/og-image.png',
              contactPoint: { '@type': 'ContactPoint', email: 'girish@greatlearning.in', contactType: 'customer support' },
              sameAs: ['https://github.com/outreachai-hq/outreachai'],
            },
            {
              '@type': 'SoftwareApplication',
              '@id': 'https://outreachai.in/#app',
              name: 'OutreachAI',
              url: 'https://outreachai.in',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'Free all-in-one B2B sales outreach platform. LinkedIn automation, cold email sequences, CRM pipeline, workflow automation, meeting scheduler. Free alternative to Lemlist and HubSpot.',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free during beta — no credit card required' },
              featureList: 'LinkedIn automation, Cold email sequences, Email warmup, A/B testing, CRM pipeline, Workflow automation, Meeting scheduler, Website visitor tracking, AI personalization',
              keywords: 'lemlist alternative, hubspot alternative, instantly alternative, saleshandy alternative, cold email tool, linkedin outreach automation, sales crm, b2b outreach',
              publisher: { '@id': 'https://outreachai.in/#org' },
              isAccessibleForFree: true,
              inLanguage: 'en',
            },
          ],
        })}} />
      </head>
      <body className="min-h-full flex flex-col">
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-4JZ20L4ZBZ" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-4JZ20L4ZBZ');`}</Script>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
