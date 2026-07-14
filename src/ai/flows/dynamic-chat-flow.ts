/**
 * @fileOverview Flux de chat VisioNode Core V6.0 — Architecture modulaire.
 * Logs structurés [CHAT_LLM] et [CHAT_RAG].
 */

import { chatOrchestrator } from '@/lib/ai/chat-router';
import type { ChatMessage } from '@/lib/chat-storage/types';

type ChatInput = {
  history: ChatMessage[];
  message: string;
  mode?: 'web' | 'hybride' | 'locale';
};

export async function dynamicChat(input: ChatInput) {
  const ts = new Date().toLocaleTimeString();
  console.log(`🤖 [CHAT_LLM] [INIT] [${ts}] Traitement message utilisateur (mode: ${input.mode || 'web'}).`);

  if (!input.message.trim()) throw new Error("Message vide");
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY non configurée.");

  const result = await chatOrchestrator.process({
    message: input.message,
    history: input.history,
    mode: input.mode || 'web',
    online: true,
  });

  console.log(`✅ [CHAT_LLM] [SUCCESS] [${ts}] Réponse générée par ${result.provider}.`);

  return {
    text: result.text,
    provider: result.provider,
    media: result.media,
    procedureId: result.procedureId,
    sources: result.sources,
    ragResults: result.ragResults,
  };
}
