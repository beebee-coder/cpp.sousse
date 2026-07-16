/**
 * @fileOverview Client Weaviate Cloud unifié avec retry, timeout et health-check.
 * Remplace à la fois src/lib/weaviate-client.ts et src/lib/weaviate/weaviate-cloud-client.ts.
 */

import weaviate, { type WeaviateClient } from 'weaviate-client';

let _client: WeaviateClient | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 60_000;

interface WeaviateConfig {
  url: string;
  apiKey: string;
  openAiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

function parseHost(rawUrl: string): string {
  return rawUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

async function createWeaviateClient(config: WeaviateConfig): Promise<WeaviateClient> {
  const host = parseHost(config.url);
  const client = await weaviate.connectToWeaviateCloud(host, {
    authCredentials: new weaviate.ApiKey(config.apiKey),
    headers: config.openAiKey ? { 'X-OpenAI-Api-Key': config.openAiKey } : undefined,
  });

  return client;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500,
  label = 'Weaviate'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err.code === 'P1001' ||
        err.code === 'P1002' ||
        err.message?.includes('timeout') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('network') ||
        err.status === 429 ||
        err.status === 502 ||
        err.status === 503;

      if (attempt < maxRetries - 1 && isRetryable) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `⚠️ [${label}] Échec (${err.message}). Nouvelle tentative ${attempt + 1}/${maxRetries} dans ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(`Échec inattendu de l'opération ${label}`);
}

export async function getWeaviateClient(): Promise<WeaviateClient> {
  const now = Date.now();

  if (_client && now - _lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return _client;
  }

  const weaviateURL = process.env.WEAVIATE_URL;
  const weaviateApiKey = process.env.WEAVIATE_API_KEY;

  if (!weaviateURL || !weaviateApiKey) {
    throw new Error('CONFIG_MANQUANTE : WEAVIATE_URL et WEAVIATE_API_KEY requises.');
  }

  if (_client) {
    try {
      await _client.isReady();
      _lastHealthCheck = now;
      return _client;
    } catch {
      console.warn('⚠️ [WEAVIATE] Client en cache non disponible, reconnexion...');
      _client = null;
    }
  }

  _client = await withRetry(
    () => createWeaviateClient({
      url: weaviateURL,
      apiKey: weaviateApiKey,
      openAiKey: process.env.OPENAI_API_KEY || '',
    }),
    3,
    500,
    'WEAVIATE_CONNECT'
  );

  _lastHealthCheck = now;
  console.log('✅ [WEAVIATE] Client connecté et healthy.');
  return _client;
}

export async function disconnectWeaviate(): Promise<void> {
  if (_client) {
    try {
      await _client.close();
    } catch {
      // ignore close errors
    }
    _client = null;
    _lastHealthCheck = 0;
  }
}

export async function withWeaviateClient<T>(operation: (client: WeaviateClient) => Promise<T>): Promise<T> {
  const client = await getWeaviateClient();
  return operation(client);
}
