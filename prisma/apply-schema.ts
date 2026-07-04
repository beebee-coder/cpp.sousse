
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim();

async function applySchema() {
  console.log('📡 [SCHEMA] Synchronisation physique Neon...');
  
  if (!connectionString) {
    console.error('❌ [SCHEMA] DATABASE_URL manquante.');
    process.exit(1);
  }

  const sql = neon(connectionString);

  try {
    // 1. Table des utilisateurs
    await sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "password" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'user',
        "approved" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "lastSyncAt" TIMESTAMP(3)
      )
    `;

    // Patch : S'assurer que lastSyncAt existe si la table existait déjà
    try {
      await sql`ALTER TABLE "users" ADD COLUMN "lastSyncAt" TIMESTAMP(3)`;
    } catch (e) {
      // Colonne probablement déjà présente
    }

    // 2. Table des procédures
    await sql`
      CREATE TABLE IF NOT EXISTS "procedures" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "code" TEXT UNIQUE NOT NULL,
        "description" TEXT,
        "category" TEXT NOT NULL,
        "department" TEXT,
        "criticality" TEXT NOT NULL DEFAULT 'low',
        "version" TEXT NOT NULL DEFAULT '1.0.0',
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "steps" JSONB NOT NULL,
        "prerequisites" JSONB,
        "authorId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "lastExecutedAt" TIMESTAMP(3),
        "executionCount" INTEGER NOT NULL DEFAULT 0
      )
    `;

    // 3. Table des connaissances sémantiques
    await sql`
      CREATE TABLE IF NOT EXISTS "knowledge_items" (
        "id" TEXT PRIMARY KEY,
        "type" TEXT NOT NULL DEFAULT 'qa',
        "title" TEXT NOT NULL,
        "question" TEXT,
        "answer" TEXT,
        "content" TEXT,
        "steps" JSONB,
        "tags" TEXT[],
        "category" TEXT,
        "difficulty" TEXT,
        "isPublic" BOOLEAN NOT NULL DEFAULT true,
        "userId" TEXT NOT NULL,
        "syncedLocal" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `;

    console.log('✅ [SCHEMA] Registre SQL synchronisé.');
  } catch (error: any) {
    console.error('❌ [SCHEMA] Échec :', error.message);
  }
}

applySchema();
