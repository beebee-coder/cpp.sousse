import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger explicitement l'environnement pour la CLI Prisma 7
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Configuration Souveraine Prisma 7.8.0.
 * Résout l'erreur P1012 en centralisant la détection de DATABASE_URL.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  engine: {
    type: 'wasm',
  },
  datasource: {
    // Nettoyage de la chaîne pour éviter les erreurs de driver Neon
    url: (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim(),
  },
});
