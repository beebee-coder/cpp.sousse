//src/lib/auth/cloud-auth.ts
import { jwtVerify } from 'jose';
import { SessionUser } from './local-auth';

const SECRET = process.env.AUTH_SECRET;

/**
 * Vérifie un JWT de transfert web→desktop (issuer `visionode-web`,
 * audience `visionode-desktop`) de façon autonome. Utilisé par le backend
 * cloud / le routeur local pour valider le handoff token émis par
 * `createDesktopHandoffToken`, sans dépendre d'un second round-trip.
 *
 * AVERTISSEMENT : ne jamais renvoyer d'identité factice ou d'administrateur
 * codé en dur. Un token non vérifié doit retourner `null`.
 */
export const cloudAuth = {
  verifyCloudToken: async (token: string): Promise<SessionUser | null> => {
    if (!token || !SECRET) return null;

    try {
      const encodedSecret = new TextEncoder().encode(SECRET);
      const { payload } = await jwtVerify(token, encodedSecret, {
        algorithms: ['HS256'],
        issuer: 'visionode-web',
        audience: 'visionode-desktop',
      });

      const user = (payload as any).user;
      if (!user || !user.id || typeof user.id !== 'string') return null;

      return {
        id: String(user.id),
        email: typeof user.email === 'string' ? user.email : '',
        role: typeof user.role === 'string' ? user.role : 'user',
      };
    } catch {
      return null;
    }
  },
};
