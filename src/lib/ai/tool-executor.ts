import { toolRegistry, type ToolResult, parseToolCall } from './tool-registry';

export class ToolExecutor {
  private authContext?: { userId?: string; mode: 'web' | 'hybride' | 'locale' };

  setAuthContext(context: { userId?: string; mode: 'web' | 'hybride' | 'locale' }) {
    this.authContext = context;
  }

  async execute(name: string, params: any): Promise<ToolResult> {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Nom d\'outil invalide' };
    }

    const sanitizedParams = this.sanitizeParams(params);
    console.log(`[TOOL_EXECUTOR] Exécution de l'outil: ${name}`, sanitizedParams);

    const result = await toolRegistry.execute(name, sanitizedParams);

    if (!result.success) {
      console.warn(`[TOOL_EXECUTOR] Échec de l'outil ${name}:`, result.error);
    }

    return result;
  }

  private sanitizeParams(params: any): any {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, 10000);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 100);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeParams(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const toolExecutor = new ToolExecutor();
