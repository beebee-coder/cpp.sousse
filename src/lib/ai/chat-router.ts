import { GroqMessage } from './groq-provider';
import { RAGResult } from './rag-orchestrator';
import { toolRegistry, type ToolResult, buildToolDefinitionsMessage } from './tool-registry';
import { contextManager } from './context-manager';
import { chatWithGroq, chatWithGroqStream, GroqKeyMissingError } from './groq-provider';
import { toolExecutor } from './tool-executor';
import { parseToolCall } from './tool-registry';
import { detectHybridCapabilities, getPreferredProvider, type HybridMode } from './hybrid-bridge';
import { vercelAdapter } from './vercel-adapter';

export interface ChatOrchestratorInput {
  message: string;
  history: import('@/lib/chat-storage/types').ChatMessage[];
  mode: HybridMode;
  online: boolean;
  userId?: string;
  userName?: string;
  onStreamChunk?: (chunk: string) => void;
}

export interface ChatOrchestratorResult {
  text: string;
  provider: string;
  model: string;
  toolUsed?: string;
  media?: { type: 'image' | 'video'; url: string }[];
  procedureId?: string;
  guideUrl?: string;
  executeUrl?: string;
  tokensUsed?: number;
  sources: string[];
  ragResults: RAGResult[];
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export class ChatOrchestrator {
  async process(input: ChatOrchestratorInput): Promise<ChatOrchestratorResult> {
    const capabilities = detectHybridCapabilities(input.mode, input.online);
    const context = await contextManager.buildContext(input.message, input.history, input.mode, input.userName);
    const messages = contextManager.buildMessages(context, input.history, input.message, input.userName);

    toolExecutor.setAuthContext({ userId: input.userId, mode: input.mode });

    if (capabilities.canUseNativeGroq && input.mode !== 'web') {
      return await this.processWithNativeGroq(input, context, messages, capabilities);
    }

    // R2 — mode locale côté web (non-Tauri) : pas de Groq natif disponible et
    // canUseCloudAPI=false en locale. On bascule sur un RAG lexical seul au lieu
    // de tenter un appel cloud voué à l'échec (offline pur). Évite le blocage
    // total en web+locale hors-ligne.
    if (input.mode === 'locale' && !capabilities.canUseNativeGroq) {
      const ragText = context.context && context.context !== 'AUCUN_CONTEXTE'
        ? `D'après la base de connaissances locale :\n\n${context.context}`
        : "Mode local : aucune information disponible dans la base de connaissances ne répond à votre question.";
      return {
        text: this.sanitizeResultText(ragText),
        provider: 'RAG Local (sans Groq)',
        model: 'offline-lexical',
        sources: context.sources,
        ragResults: context.ragResults,
        confidence: context.confidence,
      };
    }

    return await this.processWithCloudGroq(input, context, messages, capabilities);
  }

  private sanitizeResultText(text: string): string {
    return text
      .replace(/<environment_details\b[^>]*>[\s\S]*?<\/environment_details>/gi, '')
      .replace(/<[^>\n]+>/g, '')
      .trim();
  }

  private async processWithNativeGroq(
    input: ChatOrchestratorInput,
    context: any,
    messages: GroqMessage[],
    capabilities: any
  ): Promise<ChatOrchestratorResult> {
    const groqMessages: GroqMessage[] = [
      { role: 'system', content: this.buildNativeSystemPrompt(context) },
      ...messages.slice(1),
    ];

    try {
      const result = await chatWithGroq(groqMessages, {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        maxTokens: 500,
      });

      const text = this.sanitizeResultText(result.text);
      return {
        text,
        provider: result.provider,
        model: result.model,
        sources: context.sources,
        ragResults: context.ragResults,
        confidence: context.confidence,
      };
    } catch (err: any) {
      console.error('[CHAT_ORCHESTRATOR] Erreur Groq natif:', err.message);
      if (capabilities.fallbackAvailable && capabilities.canUseCloudAPI) {
        return await this.processWithCloudGroq(input, context, messages, capabilities);
      }
      throw new Error(`LIAISON_IA_ERREUR : ${err.message}`);
    }
  }

  private async processWithCloudGroq(
    input: ChatOrchestratorInput,
    context: any,
    messages: GroqMessage[],
    capabilities: any
  ): Promise<ChatOrchestratorResult> {
    const toolDefMsg = toolRegistry.getDefinitions().length > 0 ? [buildToolDefinitionsMessage()] : [];
    const groqMessages: GroqMessage[] = [
      { role: 'system', content: contextManager.buildSystemPrompt(context) },
      ...toolDefMsg,
      ...messages.slice(1),
    ];

    let result;
    try {
      if (input.onStreamChunk) {
        result = await chatWithGroqStream(groqMessages, input.onStreamChunk, vercelAdapter.getGroqOptions());
      } else {
        result = await chatWithGroq(groqMessages, vercelAdapter.getGroqOptions());
      }
    } catch (err: any) {
      // R5 — Repli RAG seul : si la clé Groq est absente (web sans clé, ou
      // panne d'auth), on ne lève pas d'erreur bloquante. On répond avec le
      // contexte RAG lexical déjà récupéré plutôt que de rompre la liaison.
      if (err instanceof GroqKeyMissingError || err?.name === 'GroqKeyMissingError') {
        const ragText = context.context && context.context !== 'AUCUN_CONTEXTE'
          ? `D'après la base de connaissances :\n\n${context.context}`
          : "La clé d'API Groq n'est pas configurée et aucune information disponible dans la base de connaissances ne répond à votre question.";
        return {
          text: this.sanitizeResultText(ragText),
          provider: 'RAG Local (sans Groq)',
          model: 'offline-lexical',
          sources: context.sources,
          ragResults: context.ragResults,
          confidence: context.confidence,
        };
      }
      throw err;
    }

    const toolCall = parseToolCall(result.text);
    let toolResult: ToolResult | undefined;
    let finalText = result.text;

    if (toolCall) {
      toolResult = await toolExecutor.execute(toolCall.tool, toolCall.params);
      if (toolResult.success && toolResult.data) {
        finalText = toolResult.data.text || JSON.stringify(toolResult.data);
      } else if (toolResult.error) {
        finalText = `[Outil ${toolCall.tool}] Erreur: ${toolResult.error}`;
      }
    }

    // ── Liaison JSON metadata → média affichable ──────────────────────────
    // Si l'IA a trouvé une info dans un JSON metadata d'actif Bank, on propose
    // l'affichage de l'image/vidéo associée (cloud: url directe ; local: binaire
    // résolu via /api/registry depuis .local-db/.registry). Auto-proposition.
    const bankMedia = await this.resolveBankMedia(context.ragResults);
    const media = toolResult?.media && toolResult.media.length
      ? toolResult.media
      : bankMedia;

    return {
      text: this.sanitizeResultText(finalText),
      provider: result.provider,
      model: result.model,
      toolUsed: toolCall?.tool,
      media,
      procedureId: toolResult?.procedureId,
      guideUrl: toolResult?.guideUrl,
      executeUrl: toolResult?.executeUrl,
      tokensUsed: result.tokensUsed,
      sources: context.sources,
      ragResults: context.ragResults,
      confidence: context.confidence,
    };
  }

  /**
   * Dérive les médias affichables depuis les résultats RAG Bank.
   * Cloud : `metadata.url` (Vercel Blob). Local : `metadata.path` résolu via
   * l'API /api/registry qui sert le binaire depuis .registry/.local-db.
   */
  private async resolveBankMedia(results: RAGResult[]): Promise<{ type: 'image' | 'video'; url: string }[]> {
    const bankHits = results.filter(
      r => (r.metadata as any)?.knowledgeType === 'bank' && ((r.metadata as any)?.url || (r.metadata as any)?.path)
    );
    if (bankHits.length === 0) return [];

    const out: { type: 'image' | 'video'; url: string }[] = [];
    for (const hit of bankHits.slice(0, 4)) {
      const meta = hit.metadata as any;
      const mediaType: 'image' | 'video' = meta.type === 'video' ? 'video' : 'image';

      if (meta.url && /^https?:\/\//.test(meta.url)) {
        out.push({ type: mediaType, url: meta.url });
        continue;
      }

      if (meta.path) {
        try {
          const relPath = String(meta.path).replace(/^\/+/, '');
          const res = await fetch(`/api/registry?path=${encodeURIComponent(relPath)}`);
          const json = await res.json().catch(() => null);
          if (json?.success && json.content) {
            out.push({ type: mediaType, url: json.content });
          }
        } catch {
          // média local non résolu : on ignore silencieusement
        }
      }
    }
    return out;
  }

  private buildNativeSystemPrompt(context: any): string {
    const userName = context.userName;
    const greeting = userName ? `Vous parlez à ${userName}. ` : '';
    const base = `Vous êtes COPILOTE-CCPE (Natif), l'IA de contrôle industriel CCP. ${greeting}Réponses techniques en français.`;
    const ragSection = context.context !== 'Aucun contexte disponible dans les référentiels.'
      ? `\nCONTEXTE RÉCUPÉRÉ:\n${context.context}`
      : '';
    const stateSection = `\nÉTAT SYSTÈME: ${context.mode}.`;

    return `${base}${ragSection}${stateSection}`;
  }
}

export const chatOrchestrator = new ChatOrchestrator();
