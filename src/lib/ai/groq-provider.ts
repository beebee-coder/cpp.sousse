import Groq from 'groq-sdk';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  onChunk?: (chunk: string) => void;
}

export interface GroqResult {
  text: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_MAX_TOKENS = 300;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'votre_cle_groq_ici') {
    throw new Error('GROQ_API_KEY manquante ou invalide');
  }
  return new Groq({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGroqWithRetry(
  client: Groq,
  messages: GroqMessage[],
  options: GroqCompletionOptions = {}
): Promise<GroqResult> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.1,
    maxTokens = DEFAULT_MAX_TOKENS,
    stream = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;

  if (stream) {
    return await callGroqStreamWithRetry(client, messages, { model, temperature, maxTokens, timeoutMs, retries, retryDelayMs, onChunk: options.onChunk });
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        messages,
        model,
        temperature,
        max_tokens: maxTokens,
      });

      const text = completion.choices[0]?.message?.content;
      if (!text?.trim()) {
        throw new Error('Réponse vide du modèle');
      }

      return {
        text: text.trim(),
        provider: `Groq LPU + Pro-Search (${model})`,
        model,
        tokensUsed: completion.usage?.total_tokens,
      };
    } catch (err: any) {
      lastError = err;

      const isRateLimit = err.status === 429 || err.message?.includes('rate_limit');
      const isServerError = err.status >= 500 || err.message?.includes('server_error');

      if (attempt < retries && (isRateLimit || isServerError)) {
        const backoff = retryDelayMs * Math.pow(2, attempt);
        console.warn(`[GROQ_PROVIDER] Tentative ${attempt + 1}/${retries + 1} échouée (${lastError?.message || 'inconnue'}). Nouvelle tentative dans ${backoff}ms...`);
        await delay(backoff);
        continue;
      }

      break;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('Échec inattendu de l\'appel Groq');
}

async function callGroqStreamWithRetry(
  client: Groq,
  messages: GroqMessage[],
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    retries: number;
    retryDelayMs: number;
    onChunk?: (chunk: string) => void;
  }
): Promise<GroqResult> {
  const { model, temperature, maxTokens, timeoutMs, retries, retryDelayMs, onChunk } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const streamResult = await client.chat.completions.create({
        messages,
        model,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of streamResult) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk?.(delta);
        }
      }

      if (!fullText.trim()) {
        throw new Error('Réponse vide du modèle');
      }

      return {
        text: fullText.trim(),
        provider: `Groq LPU + Pro-Search (${model})`,
        model,
      };
    } catch (err: any) {
      lastError = err;

      const isRateLimit = err.status === 429 || err.message?.includes('rate_limit');
      const isServerError = err.status >= 500 || err.message?.includes('server_error');

      if (attempt < retries && (isRateLimit || isServerError)) {
        const backoff = retryDelayMs * Math.pow(2, attempt);
        console.warn(`[GROQ_PROVIDER] Stream tentative ${attempt + 1}/${retries + 1} échouée (${lastError?.message || 'inconnue'}). Nouvelle tentative dans ${backoff}ms...`);
        await delay(backoff);
        continue;
      }

      break;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('Échec inattendu du flux Groq');
}

export async function chatWithGroq(
  messages: GroqMessage[],
  options: GroqCompletionOptions = {}
): Promise<GroqResult> {
  const client = getGroqClient();
  const primaryModel = options.model || DEFAULT_MODEL;

  try {
    return await callGroqWithRetry(client, messages, { ...options, model: primaryModel });
  } catch (err: any) {
    const isModelError = err.status === 404 || err.message?.includes('model') || err.message?.includes('decommissioned');
    if (isModelError && primaryModel !== FALLBACK_MODEL) {
      console.warn(`[GROQ_PROVIDER] Modèle ${primaryModel} indisponible. Bascule sur ${FALLBACK_MODEL}...`);
      return await callGroqWithRetry(client, messages, { ...options, model: FALLBACK_MODEL });
    }
    throw err;
  }
}

export async function chatWithGroqStream(
  messages: GroqMessage[],
  onChunk: (chunk: string) => void,
  options: Omit<GroqCompletionOptions, 'stream'> = {}
): Promise<GroqResult> {
  const client = getGroqClient();
  const result = await callGroqWithRetry(client, messages, { ...options, stream: true, onChunk });
  return result;
}
