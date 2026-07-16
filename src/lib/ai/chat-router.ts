import { GroqMessage } from './groq-provider';
import { RAGResult } from './rag-orchestrator';
import { toolRegistry, type ToolResult, buildToolDefinitionsMessage } from './tool-registry';
import { contextManager } from './context-manager';
import { chatWithGroq, chatWithGroqStream } from './groq-provider';
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
        maxTokens: 300,
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
    if (input.onStreamChunk) {
      result = await chatWithGroqStream(groqMessages, input.onStreamChunk, vercelAdapter.getGroqOptions());
    } else {
      result = await chatWithGroq(groqMessages, vercelAdapter.getGroqOptions());
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

    return {
      text: this.sanitizeResultText(finalText),
      provider: result.provider,
      model: result.model,
      toolUsed: toolCall?.tool,
      media: toolResult?.media,
      procedureId: toolResult?.procedureId,
      tokensUsed: result.tokensUsed,
      sources: context.sources,
      ragResults: context.ragResults,
      confidence: context.confidence,
    };
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
