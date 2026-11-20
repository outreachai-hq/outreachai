import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email/welcomeEmail'
import { isAdminEmail } from '@/lib/adminEmails'

const oauthProviders = [
  // ── Google ─────────────────────────────────────────────────────────────────
  GoogleProvider({
    clientId:     process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),

  // ── GitHub ─────────────────────────────────────────────────────────────────
  ...(process.env.GITHUB_CLIENT_ID ? [GitHubProvider({
    clientId:     process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  })] : []),
]

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/auth-error' },
  providers: [
    ...oauthProviders,

    // ── Email + Password ───────────────────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        // null password = Google-only account; block credentials login
        if (!user || !user.password) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, plan: user.plan }
      },
    }),
  ],

  callbacks: {
    // Create DB user on first OAuth sign-in (any provider)
    async signIn({ user, account }) {
      const oauthProviders = ['google', 'github']
      if (account?.provider && oauthProviders.includes(account.provider)) {
        if (!user.email) return false
        try {
          const existing = await prisma.user.findUnique({ where: { email: user.email } })
          if (!existing) {
            await prisma.user.create({
              data: {
                email:    user.email,
                name:     user.name ?? user.email.split('@')[0],
                password: null,
                plan:     'free',
              },
            })
            await sendWelcomeEmail({ to: user.email })
          }
        } catch (err) {
          console.error('[auth] signIn DB error:', err)
          return true
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id   = user.id
        token.name = user.name
        token.plan = (user as { plan?: string }).plan
      }

      // OAuth login — look up DB on initial sign-in
      const oauthProviders = ['google', 'github']
      if (account?.provider && oauthProviders.includes(account.provider) && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { id: true, name: true, plan: true },
          })
          if (dbUser) {
            token.id   = dbUser.id
            token.name = dbUser.name ?? token.name
            token.plan = dbUser.plan
          }
        } catch (err) {
          console.error('[auth] jwt DB lookup error:', err)
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id   as string
        session.user.name = token.name as string | null | undefined
        session.user.plan = token.plan as string | undefined
        session.user.isAdmin = isAdminEmail(session.user.email)
      }
      return session
    },
  },
})

