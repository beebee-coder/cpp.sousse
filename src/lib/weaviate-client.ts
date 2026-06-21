
/**
 * @fileOverview Client Weaviate Cloud pour le RAG en mode Web.
 */

import weaviate, { type WeaviateClient } from 'weaviate-client';

let _client: WeaviateClient | null = null;

export async function getWeaviateClient(): Promise<WeaviateClient> {
  if (_client) return _client;

  const weaviateURL = process.env.WEAVIATE_URL;
  const weaviateApiKey = process.env.WEAVIATE_API_KEY;

  if (!weaviateURL || !weaviateApiKey) {
    throw new Error('CONFIG_MANQUANTE : WEAVIATE_URL et WEAVIATE_API_KEY doivent être configurées pour le mode Web.');
  }

  // Nettoyage de l'URL pour Weaviate Client v3+
  const host = weaviateURL.replace('https://', '').replace('http://', '');

  _client = await weaviate.connectToWeaviateCloud(host, {
    authCredentials: new weaviate.ApiKey(weaviateApiKey),
    headers: {
      'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '', // Optionnel selon le vectorizer
    }
  });

  return _client;
}
