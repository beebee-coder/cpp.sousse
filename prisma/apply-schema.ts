import { prisma } from '../src/lib/db/prisma-client';

async function main() {
  console.log('Applying schema to database...');
  
  // DDL commands
  const commands = [
    `DROP TABLE IF EXISTS "knowledge_items" CASCADE`,
    `DROP TABLE IF EXISTS "users" CASCADE`,
    `CREATE SCHEMA IF NOT EXISTS "public"`,
    `CREATE TABLE "users" (
        "id" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'user',
        "approved" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "lastSyncAt" TIMESTAMP(3),
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE "knowledge_items" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "question" TEXT,
        "answer" TEXT,
        "steps" JSONB,
        "tags" TEXT[],
        "category" TEXT,
        "difficulty" TEXT NOT NULL DEFAULT 'medium',
        "isPublic" BOOLEAN NOT NULL DEFAULT true,
        "syncedLocal" BOOLEAN NOT NULL DEFAULT false,
        "vectorId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX "users_email_key" ON "users"("email")`,
    `CREATE INDEX "knowledge_items_userId_idx" ON "knowledge_items"("userId")`,
    `CREATE INDEX "knowledge_items_type_idx" ON "knowledge_items"("type")`,
    `CREATE INDEX "knowledge_items_syncedLocal_idx" ON "knowledge_items"("syncedLocal")`,
    `CREATE INDEX "knowledge_items_createdAt_idx" ON "knowledge_items"("createdAt")`,
  ];

  for (const cmd of commands) {
    try {
      await prisma.$executeRawUnsafe(cmd);
      console.log('✅ Executed:', cmd.substring(0, 50) + '...');
    } catch (e) {
      console.error('❌ Failed:', cmd.substring(0, 50) + '...');
      console.error(e);
    }
  }
  
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    console.log('✅ Executed foreign key constraint');
  } catch (e) {
    console.log('ℹ️ Foreign key might already exist, ignoring error.');
  }

  console.log('Done applying schema!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
