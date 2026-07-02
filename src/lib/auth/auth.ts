// src/lib/auth.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma-client";
import { authenticateUser } from "@/lib/auth/auth-store";

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
          return null;
        }

        const result = await authenticateUser(credentials.email, credentials.password);

        if (!result.success || !result.user) {
          return null;
        }

        return {
          id: result.user.id,
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          approved: result.user.approved
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.approved = user.approved;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.approved = token.approved as boolean;
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
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development"
});

// ✅ Types pour NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      firstName: string;
      lastName: string;
      approved: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    approved: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    approved: boolean;
  }
}