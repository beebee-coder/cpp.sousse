export { chatOrchestrator, type ChatOrchestratorInput, type ChatOrchestratorResult } from './chat-router';
export { ragOrchestrator } from './rag-orchestrator';
export { ragHub, RAGHub } from './rag/hub';
export { ragConnections } from './rag/connections';
export { contextManager } from './context-manager';

// Enregistre les connexions RAG factorisées (effet de bord unique).
import './rag/connections/procedures';
import './rag/connections/knowledge';
import './rag/connections/bank';
export { toolRegistry, buildToolDefinitionsMessage, parseToolCall, type AppTool, type ToolResult } from './tool-registry';
export { toolExecutor } from './tool-executor';
export { chatWithGroq, chatWithGroqStream, GroqKeyMissingError, type GroqMessage, type GroqCompletionOptions, type GroqResult } from './groq-provider';
export { detectHybridCapabilities, getPreferredProvider, type HybridMode, type HybridCapabilities } from './hybrid-bridge';
export { vercelAdapter } from './vercel-adapter';
export { registerAppTools } from './tools';
