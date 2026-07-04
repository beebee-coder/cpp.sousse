/*
  Warnings:

  - You are about to drop the column `difficulty` on the `knowledge_items` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `knowledge_items` table. All the data in the column will be lost.
  - You are about to drop the column `steps` on the `knowledge_items` table. All the data in the column will be lost.
  - You are about to drop the column `syncedLocal` on the `knowledge_items` table. All the data in the column will be lost.
  - You are about to drop the column `vectorId` on the `knowledge_items` table. All the data in the column will be lost.
  - You are about to drop the column `alarms` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `currentStep` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `events` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `fallbacks` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `signature` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `procedure_executions` table. All the data in the column will be lost.
  - You are about to drop the column `approvers` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `avgDuration` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `parameters` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `postExecution` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `subcategory` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `successRate` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `syncedLocal` on the `procedures` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `procedures` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'chef_de_bloc', 'chef_de_quart', 'user');

-- DropForeignKey
ALTER TABLE "knowledge_items" DROP CONSTRAINT "knowledge_items_userId_fkey";

-- DropForeignKey
ALTER TABLE "procedure_executions" DROP CONSTRAINT "procedure_executions_procedureId_fkey";

-- DropIndex
DROP INDEX "knowledge_items_userId_idx";

-- DropIndex
DROP INDEX "procedure_executions_operatorId_idx";

-- DropIndex
DROP INDEX "procedure_executions_procedureId_idx";

-- DropIndex
DROP INDEX "procedures_code_idx";

-- DropIndex
DROP INDEX "procedures_status_idx";

-- AlterTable
ALTER TABLE "knowledge_items" DROP COLUMN "difficulty",
DROP COLUMN "isPublic",
DROP COLUMN "steps",
DROP COLUMN "syncedLocal",
DROP COLUMN "vectorId",
ADD COLUMN     "content" TEXT;

-- AlterTable
ALTER TABLE "procedure_executions" DROP COLUMN "alarms",
DROP COLUMN "createdAt",
DROP COLUMN "currentStep",
DROP COLUMN "events",
DROP COLUMN "fallbacks",
DROP COLUMN "notes",
DROP COLUMN "result",
DROP COLUMN "signature",
DROP COLUMN "updatedAt",
ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "procedures" DROP COLUMN "approvers",
DROP COLUMN "avgDuration",
DROP COLUMN "department",
DROP COLUMN "metadata",
DROP COLUMN "parameters",
DROP COLUMN "postExecution",
DROP COLUMN "subcategory",
DROP COLUMN "successRate",
DROP COLUMN "syncedLocal",
DROP COLUMN "version",
ALTER COLUMN "category" DROP DEFAULT,
ALTER COLUMN "criticality" SET DEFAULT 'NORMAL',
ALTER COLUMN "prerequisites" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'user';

-- AddForeignKey
ALTER TABLE "procedure_executions" ADD CONSTRAINT "procedure_executions_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
