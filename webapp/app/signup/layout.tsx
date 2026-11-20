import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create free account',
  description: 'Start your free OutreachAI account — no credit card needed.',
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
