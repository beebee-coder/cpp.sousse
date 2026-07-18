-- AlterTable
ALTER TABLE "procedures" ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "version" TEXT,
ADD COLUMN     "parameters" JSONB,
ADD COLUMN     "postExecution" JSONB,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "mediaLibrary" JSONB;

-- AlterTable
ALTER TABLE "procedure_executions" ADD COLUMN     "currentStep" INTEGER,
ADD COLUMN     "alarms" JSONB,
ADD COLUMN     "fallbacks" JSONB,
ADD COLUMN     "events" JSONB,
ADD COLUMN     "signature" TEXT;

-- CreateTable
CREATE TABLE "procedure_versions" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "procedure_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_alarms" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "remedy" JSONB NOT NULL,
    "condition" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procedure_alarms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_documents" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procedure_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_media" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "procedure_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procedure_versions_procedureId_idx" ON "procedure_versions"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_alarms_procedureId_idx" ON "procedure_alarms"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_documents_procedureId_idx" ON "procedure_documents"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_media_procedureId_idx" ON "procedure_media"("procedureId");

-- AddForeignKey
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_alarms" ADD CONSTRAINT "procedure_alarms_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_documents" ADD CONSTRAINT "procedure_documents_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_media" ADD CONSTRAINT "procedure_media_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
