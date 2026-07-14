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
}

export class ChatOrchestrator {
  async process(input: ChatOrchestratorInput): Promise<ChatOrchestratorResult> {
    const capabilities = detectHybridCapabilities(input.mode, input.online);
    const context = await contextManager.buildContext(input.message, input.history, input.mode);
    const messages = contextManager.buildMessages(context, input.history, input.message);

    toolExecutor.setAuthContext({ userId: input.userId, mode: input.mode });

    if (capabilities.canUseNativeGroq && input.mode !== 'web') {
      return await this.processWithNativeGroq(input, context, messages, capabilities);
    }

    return await this.processWithCloudGroq(input, context, messages, capabilities);
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

      return {
        text: result.text,
        provider: result.provider,
        model: result.model,
        sources: context.sources,
        ragResults: context.ragResults,
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
      text: finalText,
      provider: result.provider,
      model: result.model,
      toolUsed: toolCall?.tool,
      media: toolResult?.media,
      procedureId: toolResult?.procedureId,
      tokensUsed: result.tokensUsed,
      sources: context.sources,
      ragResults: context.ragResults,
    };
  }

  private buildNativeSystemPrompt(context: any): string {
    const base = `Vous êtes VisioNode Core (Natif), l'IA de contrôle industriel CCP. Réponses techniques en français.`;
    const ragSection = context.context !== 'Aucun contexte disponible dans les référentiels.'
      ? `\nCONTEXTE RÉCUPÉRÉ:\n${context.context}`
      : '';
    const stateSection = `\nÉTAT SYSTÈME: ${context.mode}.`;

    return `${base}${ragSection}${stateSection}`;
  }
}

export const chatOrchestrator = new ChatOrchestrator();
