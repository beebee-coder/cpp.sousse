-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "media" JSONB,
    "procedureId" TEXT,
    "source" TEXT,
    "clientId" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_messages_conversationId_userId_idx" ON "chat_messages"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversationId_userId_clientId_key" ON "chat_messages"("conversationId", "userId", "clientId");
