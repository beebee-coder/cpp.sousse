// src/lib/auth/auth.ts
import NextAuth, { DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/db/prisma-client";  // ✅ CHANGÉ : import default
import { authenticateUser } from "@/lib/auth-store";

// ============================================================
// 🔐 CONFIGURATION NEXT AUTH V4
// ============================================================

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn('⚠️ [AUTH] Tentative sans identifiants');
          return null;
        }

        try {
          const result = await authenticateUser(credentials.email, credentials.password);

          if (!result.success || !result.user) {
            console.warn(`⚠️ [AUTH] Échec pour: ${credentials.email}`);
            return null;
          }

          console.log(`✅ [AUTH] Succès pour: ${credentials.email}`);

          return {
            id: result.user.id,
            email: result.user.email,
            name: `${result.user.firstName} ${result.user.lastName}`,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            role: result.user.role,
            approved: result.user.approved
          };
        } catch (error) {
          console.error('❌ [AUTH] Erreur:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'user';
        token.firstName = (user as any).firstName || '';
        token.lastName = (user as any).lastName || '';
        token.approved = (user as any).approved || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).firstName = token.firstName as string;
        (session.user as any).lastName = token.lastName as string;
        (session.user as any).approved = token.approved as boolean;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error"
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60 // 24h
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "default-secret-change-me",
  debug: process.env.NODE_ENV === "development"
});

// ============================================================
// ✅ TYPES POUR NEXT AUTH V4 - SIMPLIFIÉS
// ============================================================

declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
    firstName?: string;
    lastName?: string;
    approved?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
      firstName?: string;
      lastName?: string;
      approved?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    firstName?: string;
    lastName?: string;
    approved?: boolean;
  }
}