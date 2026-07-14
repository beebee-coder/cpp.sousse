import { GroqMessage } from './groq-provider';
import { ragOrchestrator, type RAGResult } from './rag-orchestrator';
import { getSystemContextSummary } from '@/lib/chroma';

export interface ChatContext {
  mode: 'web' | 'hybride' | 'locale';
  systemState: {
    mode: string;
    ragDocuments: number;
    bankAssets: number;
    localDBFiles: number;
  };
  ragResults: RAGResult[];
  context: string;
  sources: string[];
}

export class ContextManager {
  async buildContext(
    query: string,
    history: import('@/lib/chat-storage/types').ChatMessage[],
    mode: 'web' | 'hybride' | 'locale'
  ): Promise<ChatContext> {
    const systemState = await getSystemContextSummary();
    const ragResults = await ragOrchestrator.search(query, history);
    const context = ragOrchestrator.formatContext(ragResults);
    const sources = ragOrchestrator.getSources(ragResults);

    return {
      mode,
      systemState: {
        mode: systemState.mode,
        ragDocuments: systemState.ragDocuments || 0,
        bankAssets: systemState.bankAssets || 0,
        localDBFiles: systemState.localDBFiles || 0,
      },
      ragResults,
      context,
      sources,
    };
  }

  buildSystemPrompt(context: ChatContext): string {
    const basePrompt = `Vous êtes VisioNode Core. Répondez en français de manière concise et technique.
Si le contexte contient des informations pertinentes, utilisez-les.
Si le contexte est vide ou non pertinent, répondez que vous n'avez pas d'information spécifique dans les référentiels.
Ne pas inventer d'information.`;

    const ragSection = context.context !== 'Aucun contexte disponible dans les référentiels.'
      ? `\nCONTEXTE RÉCUPÉRÉ:\n${context.context}`
      : '\nCONTEXTE RÉCUPÉRÉ: Aucun résultat dans les référentiels.';

    const stateSection = `\nÉTAT SYSTÈME: Mode=${context.mode}.`;

    return `${basePrompt}${ragSection}${stateSection}`;
  }

  buildMessages(
    context: ChatContext,
    history: import('@/lib/chat-storage/types').ChatMessage[],
    userMessage: string
  ): GroqMessage[] {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const m of history.slice(-6)) {
      messages.push({
        role: m.role === 'model' ? 'assistant' as const : 'user' as const,
        content: m.content,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    return messages;
  }
}

export const contextManager = new ContextManager();
