import { defineConfig } from 'prisma/config';
import 'dotenv/config';

/**
 * Configuration Prisma 7.8.0 Stable.
 * Pilote l'injection de DATABASE_URL pour l'adaptateur Neon WASM.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: {
    type: 'wasm',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});