//src/lib/auth/local-auth.ts
export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export const localAuth = {
  getCurrentSession: (): SessionUser | null => {
    if (typeof window === 'undefined') return null;
    const session = localStorage.getItem('visionode_local_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return parsed && parsed.id ? parsed : null;
      } catch {
        return null;
      }
    }
    // Aucun utilisateur en session locale : on laisse la page de connexion
    // prendre le relais (mode local) plutôt que de se connecter automatiquement
    // avec un compte factice. L'utilisateur s'authentifie avec ses identifiants.
    return null;
  },
  
  saveSession: (user: SessionUser) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('visionode_local_session', JSON.stringify(user));
    }
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('visionode_local_session');
    }
  }
};
