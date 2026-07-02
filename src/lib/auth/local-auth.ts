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
        return JSON.parse(session);
      } catch {
        return null;
      }
    }
    // Default offline fallback user
    return {
      id: 'usr-local-001',
      email: 'operator@local.internal',
      role: 'technician',
    };
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
