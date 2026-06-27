import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Admin",
      credentials: {
        firstName: { label: "Prénom", type: "text" },
        lastName: { label: "Nom", type: "text" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        const adminFirstName = process.env.AUTH_ADMIN_FIRST_NAME;
        const adminLastName = process.env.AUTH_ADMIN_LAST_NAME;
        const adminPassword = process.env.AUTH_ADMIN_PASSWORD;

        console.log('[AUTH] 🔍 Vérification des identifiants...');
        console.log('[AUTH] AUTH_ADMIN_FIRST_NAME:', adminFirstName ? '✅ Défini' : '❌ NON DÉFINI');
        console.log('[AUTH] AUTH_ADMIN_LAST_NAME:', adminLastName ? '✅ Défini' : '❌ NON DÉFINI');
        console.log('[AUTH] AUTH_ADMIN_PASSWORD:', adminPassword ? '✅ Défini' : '❌ NON DÉFINI');

        if (!credentials?.firstName || !credentials?.lastName || !credentials?.password) {
          console.log('[AUTH] ❌ Champs manquants');
          return null;
        }

        if (credentials.firstName === adminFirstName && 
            credentials.lastName === adminLastName && 
            credentials.password === adminPassword) {
          
          console.log('[AUTH] ✅ Connexion réussie');
          return {
            id: "1",
            name: `${credentials.firstName} ${credentials.lastName}`,
            email: "admin@visionode.local",
            role: "admin"
          };
        }

        console.log('[AUTH] ❌ Échec - Identifiants incorrects');
        return null;
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      // ✅ Correction : utiliser user.id qui existe sur DefaultUser
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // ✅ Correction : étendre session.user
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };