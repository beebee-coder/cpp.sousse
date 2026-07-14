export interface VercelAdapterConfig {
  maxStreamDurationMs?: number;
  maxResponseTokens?: number;
  coldStartOptimized?: boolean;
}

export class VercelAdapter {
  private config: Required<VercelAdapterConfig>;

  constructor(config: VercelAdapterConfig = {}) {
    this.config = {
      maxStreamDurationMs: config.maxStreamDurationMs || 55_000,
      maxResponseTokens: config.maxResponseTokens || 500,
      coldStartOptimized: config.coldStartOptimized ?? true,
    };
  }

  getGroqOptions() {
    return {
      timeoutMs: 30_000,
      retries: 1,
      maxTokens: this.config.maxResponseTokens,
      temperature: 0.1,
    };
  }

  getStreamingConfig() {
    return {
      maxDurationMs: this.config.maxStreamDurationMs,
      keepAliveIntervalMs: 15_000,
    };
  }

  getColdStartOptimizations() {
    if (!this.config.coldStartOptimized) return {};

    return {
      prewarmModules: true,
      cacheRAGResults: true,
      cacheTTLms: 60_000,
    };
  }

  validatePayload(body: any): { valid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { valid: false, error: 'Payload invalide' };
    }

    if (!body.message || typeof body.message !== 'string') {
      return { valid: false, error: 'Message requis' };
    }

    if (body.message.length > 10000) {
      return { valid: false, error: 'Message trop long (max 10000 caractères)' };
    }

    if (body.history && !Array.isArray(body.history)) {
      return { valid: false, error: 'History doit être un tableau' };
    }

    if (body.history && body.history.length > 50) {
      return { valid: false, error: 'History trop longue (max 50 messages)' };
    }

    return { valid: true };
  }

  getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    };
  }
}

export const vercelAdapter = new VercelAdapter();
