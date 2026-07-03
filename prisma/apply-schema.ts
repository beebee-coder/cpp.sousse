import { prisma } from '../src/lib/db/prisma-client';

async function main() {
  console.log('🚀 Initialisation du Schéma Industriel VisioNode (Version Stable V23)...');
  
  const commands = [
    // Nettoyage sécurisé
    `DROP TABLE IF EXISTS "procedure_executions" CASCADE`,
    `DROP TABLE IF EXISTS "procedures" CASCADE`,
    `DROP TABLE IF EXISTS "knowledge_items" CASCADE`,
    `DROP TABLE IF EXISTS "users" CASCADE`,
    
    // Table Utilisateurs
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

    // Table Connaissances RAG
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
        CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "knowledge_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`,

    // Table Procédures (Moteur Principal)
    `CREATE TABLE "procedures" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT NOT NULL DEFAULT 'OPERATION',
        "subcategory" TEXT,
        "department" TEXT NOT NULL DEFAULT 'PRODUCTION',
        "criticality" TEXT NOT NULL DEFAULT 'MEDIUM',
        "version" TEXT NOT NULL DEFAULT '1.0.0',
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "prerequisites" JSONB NOT NULL,
        "steps" JSONB NOT NULL,
        "parameters" JSONB,
        "postExecution" JSONB,
        "metadata" JSONB NOT NULL,
        "authorId" TEXT NOT NULL,
        "syncedLocal" BOOLEAN NOT NULL DEFAULT false,
        "lastExecutedAt" TIMESTAMP(3),
        "executionCount" INTEGER NOT NULL DEFAULT 0,
        "avgDuration" INTEGER,
        "successRate" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "procedures_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "procedures_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT
    )`,

    // Table Exécutions (Audit)
    `CREATE TABLE "procedure_executions" (
        "id" TEXT NOT NULL,
        "procedureId" TEXT NOT NULL,
        "operatorId" TEXT NOT NULL,
        "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endTime" TIMESTAMP(3),
        "status" TEXT NOT NULL,
        "currentStep" INTEGER NOT NULL DEFAULT -1,
        "stepsStatus" JSONB NOT NULL,
        "totalDuration" INTEGER,
        "events" JSONB,
        "alarms" JSONB,
        "fallbacks" JSONB,
        "result" JSONB,
        "notes" TEXT,
        "signature" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "procedure_executions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "procedure_executions_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE,
        CONSTRAINT "procedure_executions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT
    )`,

    // Index de performance
    `CREATE UNIQUE INDEX "users_email_key" ON "users"("email")`,
    `CREATE UNIQUE INDEX "procedures_code_key" ON "procedures"("code")`,
    `CREATE INDEX "knowledge_items_userId_idx" ON "knowledge_items"("userId")`,
    `CREATE INDEX "procedures_code_idx" ON "procedures"("code")`,
    `CREATE INDEX "procedures_status_idx" ON "procedures"("status")`,
    `CREATE INDEX "procedure_executions_procedureId_idx" ON "procedure_executions"("procedureId")`
  ];

  for (const cmd of commands) {
    try {
      await prisma.$executeRawUnsafe(cmd);
      console.log('✅ EXÉCUTÉ :', cmd.substring(0, 60) + '...');
    } catch (e: any) {
      console.error('❌ ÉCHEC :', cmd.substring(0, 60) + '...');
      console.error('Détail :', e.message);
    }
  }

  console.log('✨ Schéma industriel appliqué avec succès !');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
