// prisma.config.ts
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // ✅ datasource accepte uniquement 'url'
  datasource: {
    url: process.env.DATABASE_URL || '',
  },
});