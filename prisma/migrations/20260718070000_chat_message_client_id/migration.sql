-- Ajout de clientId pour une persistance idempotente des messages de chat (C4).
-- La clé (conversationId, userId, clientId) permet un upsert sans doublons ni
-- deleteMany+createMany (races conditionnelles évitées).

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_conversationId_userId_clientId_key" ON "chat_messages"("conversationId", "userId", "clientId");
