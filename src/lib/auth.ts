import { NextAuthOptions } from 'next-auth'
import { DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { AUTH_SESSION_MAX_AGE } from './auth-session'

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
    maxAge: AUTH_SESSION_MAX_AGE,
  },
  jwt: {
    maxAge: AUTH_SESSION_MAX_AGE,
  },
  // SECURITY FIX L4: Configuration explicite des cookies de session
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: AUTH_SESSION_MAX_AGE,
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
      // Google vérifié les emails, donc le risque de prise de controle est faible
      allowDangerousEmailAccountLinking: true,
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

        // Vérifier que l'email est vérifié
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
      try {
        // For OAuth providers, auto-verify email
        if (account?.provider && account.provider !== 'credentials') {
          if (!user.email) {
            console.error(`[Auth] OAuth signIn: no email from ${account.provider}`)
            return true // Allow sign-in anyway, email might come later
          }

          // Check if user exists already with this email
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          })

          if (existingUser && !existingUser.emailVerified) {
            // Auto-verify email for OAuth users
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { emailVerified: new Date() },
            })
          }

          console.log(`[Auth] OAuth signIn success: ${account.provider} — ${user.email}`)
        }
        return true
      } catch (error) {
        console.error('[Auth] signIn callback error:', error)
        // Return true to allow sign-in even if our custom logic fails
        // The PrismaAdapter handles the core account creation
        return true
      }
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

        // Un administrateur ne doit jamais être bloqué par l'onboarding,
        // notamment lorsqu'il se reconnecte avec Google.
        if (dbUser?.role === 'ADMIN') {
          token.needsOnboarding = false
        }
      }

      // La base de données reste la source de vérité pour les permissions.
      // Cela évite qu'un ancien JWT conserve un rôle ADMIN après un changement.
      if (!user && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          })

          if (dbUser) {
            token.role = dbUser.role
            if (dbUser.role === 'ADMIN') {
              token.needsOnboarding = false
            }
          }
        } catch (error) {
          console.error('[Auth] Impossible de rafraîchir le rôle depuis la base:', error)
        }
      }

      // Handle session update (from onboarding page)
      if (trigger === 'update' && session) {
        if (session.needsOnboarding === false) token.needsOnboarding = false
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? ''
        session.user.role = (token.role as string | undefined) ?? ''
        session.user.needsOnboarding =
          token.role !== 'ADMIN' && Boolean(token.needsOnboarding)
      }
      return session
    },
  },
}
