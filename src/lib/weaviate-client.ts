
/**
 * @fileOverview Client Weaviate Cloud optimisé pour le build Vercel et le dev local.
 * Utilise des imports statiques pour éviter l'avertissement "Critical dependency".
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
    // Remplacement de l'expression modName par un littéral statique
    const weaviateModule = await import('weaviate-client');
    const weaviate = weaviateModule.default || weaviateModule;

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
