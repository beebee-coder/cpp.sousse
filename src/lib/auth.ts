// Importer depuis le fichier de session directement
import { 
  getSessionFromCookie, 
  createSessionCookie, 
  clearSessionCookie 
} from '@/lib/session';

// Définir les fonctions d'authentification
export async function auth() {
  return getSessionFromCookie();
}

export async function signIn(user: { id: string; firstName: string; lastName: string; role: string }) {
  await createSessionCookie(user);
}

export async function signOut() {
  await clearSessionCookie();
}

// Exporter handlers pour l'API NextAuth
export const handlers = {
  GET: async (req: Request) => {
    const session = await auth();
    return new Response(JSON.stringify({ authenticated: !!session, session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  },
  POST: async (req: Request) => {
    try {
      const body = await req.json();
      const { action, user } = body;
      
      if (action === 'signin' && user) {
        await signIn(user);
        return new Response(JSON.stringify({ success: true, action: 'signin' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (action === 'signout') {
        await signOut();
        return new Response(JSON.stringify({ success: true, action: 'signout' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
