// lib/weaviate/weaviate-cloud-client.ts
import weaviate, { type WeaviateClient } from 'weaviate-client';

/**
 * Récupère le client Weaviate Cloud avec gestion d'erreur et typage correct.
 */
export async function getWeaviateClient(): Promise<WeaviateClient> {
    const weaviateURL = process.env.WEAVIATE_URL;
    const weaviateApiKey = process.env.WEAVIATE_API_KEY;

    if (!weaviateURL || !weaviateApiKey) {
        throw new Error('WEAVIATE_URL and WEAVIATE_API_KEY environment variables must be set.');
    }

    // Nettoyage de l'URL pour éviter les préfixes doubles
    const host = weaviateURL.replace('https://', '').replace('http://', '');

    return await weaviate.connectToWeaviateCloud(host, {
        authCredentials: new weaviate.ApiKey(weaviateApiKey)
    });
}
