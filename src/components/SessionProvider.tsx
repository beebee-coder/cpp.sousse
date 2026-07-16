'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { usePlatform } from '@/components/PlatformProvider';
import { localAuth } from '@/lib/auth/local-auth';
import { validateLocalSession } from '@/lib/local-sql';
import { getDesktopSession, saveDesktopSession, clearDesktopSession } from '@/lib/desktop-session';

export interface SessionUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: string;
  approved?: boolean;
  image?: string | null;
  createdAt?: number;
}

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Origine de la session affichée :
 *  - 'server' : cookie de session web (Vercel)
 *  - 'cloud'  : compte cloud transféré par deep link vers le desktop (SSO)
 *  - 'local'  : fallback local SQLite du desktop
 */
type SessionSource = 'server' | 'cloud' | 'local';

interface SessionContextValue {
  user?: SessionUser;
  role?: string;
  pendingCount: number;
  status: SessionStatus;
  source?: SessionSource;
  refresh: () => Promise<void>;
  /** Établit une session (utilisé par le handoff web→desktop). */
  login: (user: SessionUser, opts?: { persist?: boolean; source?: SessionSource }) => void;
  /** Déconnecte : purge la session cloud persistée sur desktop. */
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Source de vérité unique pour la session utilisateur.
 *
 * `initialUser` (fourni par le layout racine à partir de la session serveur)
 * permet d'initialiser le rôle de façon synchrone : l'UI (sidebar, header)
 * affiche immédiatement le bon profil (ex. ADMIN) sans phase transitoire
 * "USER" le temps d'un fetch client.
 *
 * En mode desktop (Tauri), il n'y a pas de serveur Next local : la session
 * cloud est restaurée depuis le stockage local (handoff SSO) ou depuis le
 * fallback local SQLite.
 */
export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: SessionUser;
}) {
  const { isDesktop, isReady } = usePlatform();
  const [user, setUser] = useState<SessionUser | undefined>(initialUser);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<SessionStatus>(initialUser ? 'authenticated' : 'loading');
  const [source, setSource] = useState<SessionSource | undefined>(initialUser ? 'server' : undefined);

  const load = useCallback(async () => {
    // Le desktop n'a pas d'API locale : on ne sonde pas /api/auth/me.
    if (isDesktop) return;
    try {
      const res = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const u = data.user ?? data.session?.user;
      if (u && (u.id || u.email)) {
        setUser(u as SessionUser);
        setStatus('authenticated');
      } else if (!initialUser) {
        setUser(undefined);
        setStatus('unauthenticated');
      }
    } catch {
      // En présence d'une session serveur initiale, on ne dégrade pas l'état.
      if (!initialUser) setStatus('unauthenticated');
    }
  }, [initialUser, isDesktop]);

  // Restauration de la session sur desktop (une fois la plateforme résolue).
  useEffect(() => {
    if (!isReady || initialUser || !isDesktop) return;
    const cloud = getDesktopSession();
    if (cloud?.id) {
      setUser(cloud as SessionUser);
      setSource('cloud');
      setStatus('authenticated');
    } else {
      (async () => {
        const stored = localAuth.getCurrentSession();
        const validated = await validateLocalSession(stored);
        if (validated) {
          localAuth.saveSession(validated);
          setUser(validated);
          setSource('local');
          setStatus('authenticated');
        } else {
          localAuth.clearSession();
          setUser(undefined);
          setSource(undefined);
          setStatus('unauthenticated');
        }
      })();
    }
  }, [isReady, initialUser, isDesktop]);

  useEffect(() => {
    if (isReady) void load();
  }, [load, isReady]);

  const login = useCallback((u: SessionUser, opts?: { persist?: boolean; source?: SessionSource }) => {
    setUser(u);
    setSource(opts?.source ?? 'cloud');
    setStatus('authenticated');
    if (opts?.persist !== false) saveDesktopSession(u);
  }, []);

  const logout = useCallback(() => {
    clearDesktopSession();
    if (isDesktop) {
      const local = localAuth.getCurrentSession();
      setUser(local ?? undefined);
      setStatus(local ? 'authenticated' : 'unauthenticated');
      setSource(local ? 'local' : undefined);
    } else {
      setUser(undefined);
      setStatus('unauthenticated');
      setSource(undefined);
    }
  }, [isDesktop]);

  // Compteur des inscriptions en attente — réservé aux admins, interrogé toutes les 30s.
  useEffect(() => {
    if (user?.role !== 'admin') {
      setPendingCount(0);
      return;
    }
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/auth/pending-count', { headers: { Accept: 'application/json' } });
        const d = await res.json();
        setPendingCount(d.count ?? 0);
      } catch {
        /* silencieux : indicateur non critique */
      }
    };
    void fetchPending();
    const id = setInterval(fetchPending, 30000);
    return () => clearInterval(id);
  }, [user?.role]);

  return (
    <SessionContext.Provider value={{ user, role: user?.role, pendingCount, status, source, refresh: load, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession doit être utilisé à l’intérieur de <SessionProvider>');
  }
  return ctx;
}
