import { NextAuthOptions } from 'next-auth'
import { DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

/**
 * Extended User type for NextAuth session
 * Adds role and id fields to base NextAuth User
 */
declare module 'next-auth' {
  interface User {
    id: string
    role: string
  }
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role: string
      needsOnboarding?: boolean
    }
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  // SECURITY FIX L4: Configuration explicite des cookies de session
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
    newUser: '/register',
    error: '/login',
  },
  providers: [
    // ─── OAuth Providers ───
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // SECURITY FIX C2: Supprime allowDangerousEmailAccountLinking
      // Empeche la prise de controle de compte via OAuth
    }),
    // ─── Credentials Provider ───
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error('Aucun compte avec cet email')
        }

        // OAuth users trying to login with credentials
        if (!user.passwordHash) {
          throw new Error('Ce compte utilise une connexion Google. Connecte-toi avec Google.')
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          throw new Error('Mot de passe incorrect')
        }

        // Verifier que l'email est verifie
        if (!user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, auto-verify email
      if (account?.provider && account.provider !== 'credentials') {
        // Check if user exists already with this email
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email ?? '' },
        })

        if (existingUser && !existingUser.emailVerified) {
          // Auto-verify email for OAuth users
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          })
        }
      }
      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role || 'ARTIST'

        // Check if this is a new OAuth user that needs onboarding
        // A user needs onboarding if they have no role set yet (default ARTIST from schema)
        // and they signed up via OAuth (no password)
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { passwordHash: true, role: true, createdAt: true, updatedAt: true },
        })

        if (dbUser && !dbUser.passwordHash) {
          // OAuth user - check if they just created their account (within last 30 seconds)
          const timeSinceCreation = Date.now() - dbUser.createdAt.getTime()
          if (timeSinceCreation < 30000 && dbUser.role === 'ARTIST') {
            token.needsOnboarding = true
          }
        }
      }

      // Handle session update (from onboarding page)
      if (trigger === 'update' && session) {
        if (session.role) token.role = session.role
        if (session.needsOnboarding === false) token.needsOnboarding = false
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string | undefined ?? ''
        session.user.role = token.role as string | undefined ?? ''
        if (token.needsOnboarding) {
          session.user.needsOnboarding = true
        }
      }
      return session
    },
  },
}
