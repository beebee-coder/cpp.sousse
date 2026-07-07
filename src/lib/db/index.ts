// src/lib/db/index.ts
/**
 * @fileOverview Abstraction de base de données (Radical Hybrid).
 *
 * Deux cibles, deux moteurs, UNE source de vérité métier :
 *   - CLOUD (Vercel / web) : Prisma + PostgreSQL Neon. Services via getPrisma().
 *   - LOCAL (Tauri EXE)    : SQLite embarquée servie par Rust (tauri-plugin-sql),
 *                            accédée côté webview via src/lib/local-sql.ts.
 *
 * Le webview ne peut PAS exécuter Node/Prisma (c'est un navigateur) ; c'est
 * pourquoi la DB locale est gérée par Rust et exposée via IPC, et non par Prisma
 * dans le front. Le code métier reste unifié : chaque feature passe par le
 * client API (src/lib/api-client.ts) qui route vers le cloud, ou via le pont
 * hybride (src/lib/api-hybrid.ts) qui résout local vs cloud.
 */

import { PrismaClient } from '@prisma/client';
import { prisma as neonPrisma } from './prisma-client';

let client: PrismaClient | null = null;

export async function getPrisma(): Promise<PrismaClient> {
  if (!client) client = neonPrisma;
  return client;
}

export default getPrisma;
