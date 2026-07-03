import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

// Charger explicitement les variables d'environnement
dotenv.config();

/**
 * Configuration Prisma 7.8.0 Stable.
 * Centralise l'injection de DATABASE_URL pour l'adaptateur Neon.
 * Résout l'erreur P1012 (url non supportée dans schema.prisma).
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
