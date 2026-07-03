import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // ✅ Forcer l'engine WASM - PAS de dépendance OpenSSL !
  engine: {
    type: 'wasm',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
