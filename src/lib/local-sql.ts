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
    return null;
  }
}

export interface LocalSessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

/**
 * Authentification locale (offline). Renvoie le payload de session si succès,
 * sinon null (le caller bascule alors sur le cloud).
 */
export async function localSignIn(email: string, password: string): Promise<{ success: true; user: LocalSessionUser } | null> {
  const db = await getLocalDb();
  if (!db) return null;

  try {
    const rows = await db.select(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    const u = rows && rows[0];
    if (!u || !u.approved) return null;

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return null;

    return {
      success: true,
      user: {
        id: u.id,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email: u.email,
        role: u.role,
      },
    };
  } catch (e) {
    console.error('[LOCAL_SQL] Erreur localSignIn:', e);
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
  await db.execute(
    `INSERT INTO users (id, email, firstName, lastName, password, role, approved, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(email) DO UPDATE SET
       firstName=excluded.firstName, lastName=excluded.lastName,
       role=excluded.role, approved=excluded.approved, updatedAt=datetime('now')`,
    [u.id, u.email.toLowerCase().trim(), u.firstName ?? '', u.lastName ?? '', u.password ?? '', u.role, u.approved ? 1 : 0]
  );
}
