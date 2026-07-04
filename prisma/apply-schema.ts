import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Script de Réparation SQL Atomique.
 * Injecte les colonnes manquantes (lastSyncAt) dans la base physique Neon.
 */
async function run() {
  const connectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim();
  if (!connectionString) {
    console.error('❌ DATABASE_URL manquante.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  console.log('📡 [REPAIR] Connexion au registre Neon...');

  try {
    // 1. Ajout sécurisé de la colonne lastSyncAt
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastSyncAt') THEN
          ALTER TABLE "users" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
          RAISE NOTICE '✅ Colonne lastSyncAt ajoutée à la table users.';
        ELSE
          RAISE NOTICE 'ℹ️ La colonne lastSyncAt existe déjà.';
        END IF;
      END $$;
    `);

    // 2. Vérification de la table procedures (étapes JSON)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "procedures" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "code" TEXT UNIQUE NOT NULL,
        "description" TEXT,
        "category" TEXT NOT NULL,
        "criticality" TEXT DEFAULT 'NORMAL',
        "status" TEXT DEFAULT 'DRAFT',
        "steps" JSONB NOT NULL,
        "prerequisites" JSONB,
        "authorId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "lastExecutedAt" TIMESTAMP(3),
        "executionCount" INTEGER DEFAULT 0
      );
    `);

    console.log('✅ [REPAIR] Registre SQL stabilisé.');
  } catch (err: any) {
    console.error('❌ [REPAIR] Échec SQL :', err.message);
  } finally {
    await pool.end();
  }
}

run();
