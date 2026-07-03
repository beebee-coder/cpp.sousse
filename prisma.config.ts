import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

// Charger explicitement les variables d'environnement pour le build/seed
dotenv.config();

/**
 * Configuration Prisma 7.8.0 Stable.
 * Pilote l'injection de DATABASE_URL pour l'adaptateur Neon.
 * Cette configuration assure la concordance avec le schéma lors de la génération.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  engine: {
    type: 'wasm',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
