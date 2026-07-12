// src/lib/desktop-session.ts
/**
 * Persistance locale de la session "cloud" transférée par deep link depuis
 * l'app web vers l'app desktop (Tauri). Clé dédiée afin de distinguer un
 * compte cloud réellement connecté du fallback local par défaut
 * (`visionode_local_session` dans local-auth.ts).
 */
export interface DesktopSessionUser {
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  image?: string | null;
}

const KEY = 'visionode_desktop_session';

export function saveDesktopSession(user: DesktopSessionUser): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* localStorage indisponible */
  }
}

export function getDesktopSession(): DesktopSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesktopSessionUser;
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDesktopSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
