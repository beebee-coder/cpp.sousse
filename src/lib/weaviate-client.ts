
/**
 * @fileOverview Client Weaviate Cloud optimisé pour le build Vercel.
 */

let _client: any = null;

export async function getWeaviateClient(): Promise<any> {
  if (_client) return _client;

  const weaviateURL = process.env.WEAVIATE_URL;
  const weaviateApiKey = process.env.WEAVIATE_API_KEY;

  if (!weaviateURL || !weaviateApiKey) {
    throw new Error('CONFIG_MANQUANTE : WEAVIATE_URL et WEAVIATE_API_KEY requises.');
  }

  try {
    // Masquage de l'import pour le bundler si nécessaire
    const modName = 'weaviate-client';
    const weaviate = (await import(modName)).default;

    const host = weaviateURL.replace('https://', '').replace('http://', '');

    _client = await weaviate.connectToWeaviateCloud(host, {
      authCredentials: new weaviate.ApiKey(weaviateApiKey),
      headers: {
        'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',
      }
    });

    return _client;
  } catch (error: any) {
    console.error("❌ Erreur connexion Weaviate:", error.message);
    throw error;
  }
}
