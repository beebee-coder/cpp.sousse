import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

// Chargement impératif des variables d'environnement pour Prisma 7
dotenv.config();

/**
 * Configuration Souveraine Prisma 7.8.0.
 * Centralise l'injection de DATABASE_URL pour l'adaptateur Neon.
 * Résout l'erreur P1012 (url non supportée dans schema.prisma).
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  engine: {
    type: 'wasm',
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
