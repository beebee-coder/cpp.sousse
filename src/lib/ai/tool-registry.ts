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
  guideUrl?: string;
  executeUrl?: string;
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
  if (!text) return null;
  try {
    // C3 — tolère le JSON d'appel d'outil n'importe où dans la réponse
    // (texte avant/après), et non plus strictement en début de chaîne.
    // Recherche le premier bloc objet JSON contenant une clé "tool".
    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) return null;

    // Tente d'abord le parse direct à partir de la première accolade.
    const candidate = text.slice(firstBrace);
    const parsed = JSON.parse(candidate);
    if (parsed && parsed.tool && typeof parsed.tool === 'string') {
      return { tool: parsed.tool, params: parsed.params || {} };
    }
    return null;
  } catch {
    // Parse direct échoué (accolade déséquilibrée / JSON partiel) : on
    // extrait le plus grand sous-objet JSON équilibré contenant "tool".
    try {
      const match = extractToolObject(text);
      if (match && match.tool && typeof match.tool === 'string') {
        return { tool: match.tool, params: match.params || {} };
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Extrait le premier objet JSON équilibré contenant une clé `tool`. */
function extractToolObject(text: string): { tool: string; params: any } | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        const parsed = JSON.parse(slice);
        if (parsed && parsed.tool && typeof parsed.tool === 'string') {
          return { tool: parsed.tool, params: parsed.params || {} };
        }
        return null;
      }
    }
  }
  return null;
}
