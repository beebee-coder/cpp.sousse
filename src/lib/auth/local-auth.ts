//src/lib/auth/local-auth.ts
export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

const LOCAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const localAuth = {
  getCurrentSession: (): SessionUser | null => {
    if (typeof window === 'undefined') return null;
    const session = localStorage.getItem('visionode_local_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed && parsed.id && parsed.expiresAt && Date.now() > parsed.expiresAt) {
          localStorage.removeItem('visionode_local_session');
          return null;
        }
        return parsed && parsed.id ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  },
  
  saveSession: (user: SessionUser) => {
    if (typeof window !== 'undefined') {
      const payload = {
        ...user,
        expiresAt: Date.now() + LOCAL_SESSION_TTL_MS,
      };
      localStorage.setItem('visionode_local_session', JSON.stringify(payload));
    }
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('visionode_local_session');
    }
  }
};
