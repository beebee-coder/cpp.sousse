import { GroqMessage } from './groq-provider';

export interface AppTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  execute: (params: any) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  media?: {
    type: 'image' | 'video';
    url: string;
  }[];
  procedureId?: string;
}

export class ToolRegistry {
  private tools: Map<string, AppTool> = new Map();

  register(tool: AppTool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AppTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AppTool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): any[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {},
    }));
  }

  async execute(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Outil inconnu: ${name}` };
    }
    try {
      return await tool.execute(params);
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur d\'exécution' };
    }
  }
}

export const toolRegistry = new ToolRegistry();

export function buildToolDefinitionsMessage(): GroqMessage {
  const definitions = toolRegistry.getDefinitions();
  if (definitions.length === 0) {
    return { role: 'system', content: 'Aucun outil disponible.' };
  }

  const toolsJson = JSON.stringify(definitions, null, 2);
  return {
    role: 'system',
    content: `OUTILS DISPONIBLES (utilisez le format JSON pour demander leur exécution) :
${toolsJson}

RÈGLES D'UTILISATION :
- Si l'utilisateur demande une action liée à un outil, répondez avec un JSON de la forme : {"tool": "nom_outil", "params": {...}}
- Si aucune action n'est requise, répondez normalement en texte.`,
  };
}

export function parseToolCall(text: string): { tool: string; params: any } | null {
  try {
    const cleaned = text.trim();
    if (!cleaned.startsWith('{')) return null;

    const parsed = JSON.parse(cleaned);
    if (parsed.tool && typeof parsed.tool === 'string') {
      return { tool: parsed.tool, params: parsed.params || {} };
    }
    return null;
  } catch {
    return null;
  }
}
