// src/lib/local-sql.ts
/**
 * @fileOverview Accès à la base SQLite locale (embarquée dans l'EXE via tauri-plugin-sql).
 *
 * La DB est créée + pré-remplie (migrations incluses dans le binaire Rust) au
 * premier lancement. Aucune commande n'est requise de l'utilisateur final.
 * Le webview y accède via l'API JS officielle du plugin (SQLite tourne en Rust,
 * pas de Node/native dans le navigateur). La DB grandit naturellement avec l'usage.
 *
 * En web (Vercel) ce module est inactif : tout passe par le cloud (Prisma/Neon).
 */

import Database from '@tauri-apps/plugin-sql';
import bcrypt from 'bcryptjs';
import { isDesktop } from './platform';

export const LOCAL_DB_URL = 'sqlite:visionode.sqlite';

let dbPromise: Promise<any> | null = null;

export async function getLocalDb(): Promise<any | null> {
  if (!isDesktop) return null;
  if (!dbPromise) {
    dbPromise = Database.load(LOCAL_DB_URL);
  }
  try {
    return await dbPromise;
  } catch (e) {
    console.error('[LOCAL_SQL] Échec chargement DB:', e);
    dbPromise = null;
    return null;
  }
}

export interface LocalSessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  approved: boolean;
}

export type LocalAuthError = 'DB_CORRUPTED' | 'USER_NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_DOWN' | 'UNKNOWN';

export interface LocalSignInResult {
  success: true;
  user: LocalSessionUser;
}

export interface LocalSignInFailure {
  success: false;
  errorType: 'RATE_LIMITED' | 'USER_NOT_FOUND' | 'DB_CORRUPTED' | 'UNKNOWN';
  retryAfter?: number;
}

export type LocalSignInOutcome = LocalSignInResult | LocalSignInFailure;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_STORAGE_KEY = 'visionode_rate_limit';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil: number;
}

function loadPersistedRateLimit(): Map<string, RateLimitEntry> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, RateLimitEntry>;
    const now = Date.now();
    const map = new Map<string, RateLimitEntry>();
    for (const [key, entry] of Object.entries(parsed)) {
      if (now - entry.firstAttempt <= RATE_LIMIT_WINDOW_MS) {
        map.set(key, entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function persistRateLimit(store: Map<string, RateLimitEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, RateLimitEntry> = {};
    for (const [key, entry] of store.entries()) {
      obj[key] = entry;
    }
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // localStorage plein ou indisponible
  }
}

const rateLimitStore = loadPersistedRateLimit();

function checkRateLimit(email: string): { blocked: boolean; retryAfter?: number } {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (entry) {
    if (entry.lockedUntil > now) {
      return { blocked: true, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
      persistRateLimit(rateLimitStore);
    }
  }

  return { blocked: false };
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 });
  } else {
    entry.count += 1;
    if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      entry.lockedUntil = now + RATE_LIMIT_WINDOW_MS;
    }
  }
  persistRateLimit(rateLimitStore);
}

export function clearRateLimit(email: string): void {
  rateLimitStore.delete(email.toLowerCase().trim());
  persistRateLimit(rateLimitStore);
}

/**
 * Authentification locale (offline). Renvoie le payload de session si succès,
 * sinon null (le caller bascule alors sur le cloud).
 */
export async function localSignIn(email: string, password: string): Promise<LocalSignInOutcome> {
  const db = await getLocalDb();
  if (!db) return { success: false, errorType: 'DB_CORRUPTED' };

  try {
    const rateCheck = checkRateLimit(email);
    if (rateCheck.blocked) {
      console.warn(`[LOCAL_SQL] Rate limit atteint pour ${email}. Réessayez dans ${rateCheck.retryAfter}s.`);
      return { success: false, errorType: 'RATE_LIMITED', retryAfter: rateCheck.retryAfter };
    }

    const rows = await db.select(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    const u = rows && rows[0];
    if (!u) {
      recordFailedAttempt(email);
      return { success: false, errorType: 'USER_NOT_FOUND' };
    }
    if (!u.approved) {
      return { success: false, errorType: 'USER_NOT_FOUND' };
    }

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) {
      recordFailedAttempt(email);
      return { success: false, errorType: 'USER_NOT_FOUND' };
    }

    clearRateLimit(email);
    return {
      success: true,
      user: {
        id: u.id,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email: u.email,
        role: u.role,
        approved: !!u.approved,
      },
    };
  } catch (e) {
    console.error('[LOCAL_SQL] Erreur localSignIn:', e);
    return { success: false, errorType: 'UNKNOWN' };
  }
}

const LOCAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Valide que la session locale correspond toujours à un utilisateur existant
 * et approuvé dans visionode.sqlite, et n'a pas expiré. Renvoie la session si valide, null sinon.
 */
export async function validateLocalSession(stored: { id: string; email: string; expiresAt?: number } | null): Promise<LocalSessionUser | null> {
  if (!stored?.id || !stored?.email) return null;
  // TTL : une session sans expiresAt (ou expirée) est considérée invalide.
  // localAuth.saveSession garantit expiresAt ; s'il manque, on refuse par sécurité.
  // NB : localAuth.getCurrentSession() purge déjà les sessions expirées avant
  // d'appeler cette fonction, donc cette vérification est une seconde ligne de
  // défense cohérente avec la logique de purge TTL 30 jours de local-auth.ts.
  if (!stored.expiresAt || Date.now() > stored.expiresAt) return null;

  const db = await getLocalDb();
  // En mode Locale, si la DB locale est indisponible (corrompue/verrouillée) la
  // session ne peut PAS être validée de façon fiable. On refuse plutôt que de
  // trust une session sans révocation effective : l'utilisateur est déconnecté
  // et un indicateur "Mode dégradé — base locale indisponible" l'explique (UI).
  if (!db) return null;

  try {
    const rows = await db.select(
      'SELECT id, firstName, lastName, email, role, approved FROM users WHERE id = ? AND email = ?',
      [stored.id, stored.email.toLowerCase().trim()]
    );
    const u = rows && rows[0];
    if (!u || !u.approved) return null;

    return {
      id: u.id,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      email: u.email,
      role: u.role,
      approved: !!u.approved,
    };
  } catch (e) {
    console.error('[LOCAL_SQL] Erreur validateLocalSession:', e);
    return null;
  }
}

/** Insert/Sync d'un utilisateur dans la DB locale (appelé par la sync cloud→local). */
export async function upsertLocalUser(u: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  role: string;
  approved?: boolean;
}): Promise<void> {
  const db = await getLocalDb();
  if (!db) return;
  const email = u.email.toLowerCase().trim();

  const existing = await db.select('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    // On resync toujours approved (et le hash si fourni) pour éviter un
    // lockout offline après un changement côté cloud (mot de passe / approbation).
    if (u.password) {
      await db.execute(
        `UPDATE users SET firstName=?, lastName=?, role=?, approved=?, password=?, updatedAt=datetime('now') WHERE email=?`,
        [u.firstName ?? '', u.lastName ?? '', u.role, u.approved ? 1 : 0, u.password, email]
      );
    } else {
      await db.execute(
        `UPDATE users SET firstName=?, lastName=?, role=?, approved=?, updatedAt=datetime('now') WHERE email=?`,
        [u.firstName ?? '', u.lastName ?? '', u.role, u.approved ? 1 : 0, email]
      );
    }
  } else if (u.password) {
    await db.execute(
      `INSERT INTO users (id, email, firstName, lastName, password, role, approved, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [u.id, email, u.firstName ?? '', u.lastName ?? '', u.password, u.role, u.approved ? 1 : 0]
    );
  } else {
    console.warn('[LOCAL_SQL] upsertLocalUser ignoré : mot de passe requis pour nouvel utilisateur');
  }
}
