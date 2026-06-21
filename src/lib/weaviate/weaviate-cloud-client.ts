// lib/weaviate/weaviate-cloud-client.ts
import weaviate, { WeaviateClient } from 'weaviate-client';

export function getWeaviateClient(): WeaviateClient {
    // Ces variables contiennent les identifiants copiés à l'étape 2
    const weaviateURL = process.env.WEAVIATE_URL!;
    const weaviateApiKey = process.env.WEAVIATE_API_KEY!;

    if (!weaviateURL || !weaviateApiKey) {
        throw new Error('WEAVIATE_URL and WEAVIATE_API_KEY environment variables must be set.');
    }

    return await weaviate.connectToWeaviateCloud(weaviateURL, {
        authCredentials: new weaviate.ApiKey(weaviateApiKey)
    });
}