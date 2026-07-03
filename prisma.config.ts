import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

// Charger explicitement les variables d'environnement
dotenv.config();

/**
 * Configuration Prisma 7.8.0 Stable.
 * Pilote l'injection de DATABASE_URL pour l'adaptateur Neon WASM.
 * Cette configuration remplace le champ 'url' dans schema.prisma.
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
