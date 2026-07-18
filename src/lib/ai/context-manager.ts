import { GroqMessage } from './groq-provider';
import { ragOrchestrator, type RAGResult } from './rag-orchestrator';
import { ragHub } from './rag/hub';
import { getSystemContextSummary } from '@/lib/chroma';

export interface ChatContext {
  mode: 'web' | 'hybride' | 'locale';
  userName?: string;
  systemState: {
    mode: string;
    ragDocuments: number;
    bankAssets: number;
    localDBFiles: number;
  };
  ragResults: RAGResult[];
  context: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export class ContextManager {
  getConfidenceLabel(results: RAGResult[]): 'high' | 'medium' | 'low' | 'none' {
    const filtered = results.filter(r => (r.score || 0) >= 0.2);
    if (filtered.length === 0) return 'none';
    const topScore = filtered[0]?.score || 0;
    const qaCount = filtered.filter(r => r.metadata?.knowledgeType === 'qa').length;
    if (topScore >= 0.45 && qaCount > 0) return 'high';
    if (topScore >= 0.25 && qaCount > 0) return 'medium';
    if (topScore > 0.2) return 'low';
    return 'none';
  }

  async buildContext(
    query: string,
    history: import('@/lib/chat-storage/types').ChatMessage[],
    mode: 'web' | 'hybride' | 'locale',
    userName?: string
  ): Promise<ChatContext> {
    const systemState = await getSystemContextSummary();
    // Recherche factorisée multi-connexions (RAGHub fan-out sur procedures/knowledge/bank).
    const ragResults = await ragHub.search(query, history as any[]);
    // Formatage/presentation délégué à l'orchestrateur historique (inchangé).
    const context = ragOrchestrator.formatContext(ragResults);
    const sources = ragOrchestrator.getSources(ragResults);
    const confidence = this.getConfidenceLabel(ragResults);

    return {
      mode,
      userName,
      systemState: {
        mode: systemState.mode,
        ragDocuments: systemState.ragDocuments || 0,
        bankAssets: systemState.bankAssets || 0,
        localDBFiles: systemState.localDBFiles || 0,
      },
      ragResults,
      context,
      sources,
      confidence,
    };
  }

  buildSystemPrompt(context: ChatContext): string {
    const confidence = contextManager.getConfidenceLabel(context.ragResults);
    const qaCount = context.ragResults.filter(r => r.metadata?.knowledgeType === 'qa').length;
    const userName = context.userName;

    const greeting = userName ? `Vous parlez à ${userName}. ` : '';
    const basePrompt = `Vous êtes COPILOTE-CCPE, le copilote de contrôle industriel. ${greeting}Répondez en français de manière concise et technique.
RÈGLES STRICTES:
1. UTILISEZ EN PRIORITÉ les réponses Q/R du contexte — ce sont des réponses directes validées.
2. Si une Q/R répond exactement à la question, citez-la directement sans reformulation superflue.
3. Ne pas inventer d'information. Si le contexte ne contient pas la réponse, dites-le clairement.
4. Ne jamais inclure de balises XML, HTML ou <environment_details>. Réponse en texte brut uniquement.
5. Si AUCUN_CONTEXTE ou CONFIANCE RAG: low/none, répondez que l'information n'est pas disponible dans la base de connaissances.`;

    const confidenceLine = `\nCONFIANCE RAG: ${confidence}.`;

    // Banque médias : lorsqu'un actif Bank (image/vidéo) est pertinent, l'IA
    // doit signaler qu'un visuel associé est disponible — l'UI l'affiche alors
    // automatiquement (cf. chat-router : dérivation media depuis metadata bank).
    const bankAssets = context.ragResults.filter(
      r => r.metadata?.knowledgeType === 'bank'
    );
    const bankLine = bankAssets.length > 0
      ? `\nBANQUE MÉDIAS: ${bankAssets.length} actif(s) visuel(s) lié(s) à la requête. Règle: si un actif Bank est pertinent pour la réponse, citez-le et signalez qu'une image/vidéo associée est disponible (l'aperçu s'affiche automatiquement).`
      : '';

    const ragSection = context.context !== 'AUCUN_CONTEXTE'
      ? `\nCONTEXTE RÉCUPÉRÉ:\n${context.context}`
      : '\nCONTEXTE RÉCUPÉRÉ: Aucun résultat. Informez l\'utilisateur que la knowledge base ne contient pas cette information.';

    const stateSection = `\nÉTAT SYSTÈME: Mode=${context.mode}.`;

    return `${basePrompt}${confidenceLine}${bankLine}${ragSection}${stateSection}`;
  }

  buildMessages(
    context: ChatContext,
    history: import('@/lib/chat-storage/types').ChatMessage[],
    userMessage: string,
    userName?: string
  ): GroqMessage[] {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (userName && history.length === 0) {
      messages.push({ role: 'user', content: `Bonjour, je suis ${userName}.` });
    }

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
