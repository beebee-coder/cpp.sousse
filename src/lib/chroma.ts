// Types ChromaDB — Utilisation de 'import type' pour éviter les fuites dans le bundle client
import type { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocumentToAdd {
  id: string;
  content: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SearchOptions {
  collectionName: string;
  query: string;
  nResults?: number;
  whereFilter?: Record<string, string | number | boolean>;
}

export interface SearchResult {
  id: string;
  document: string;
  metadata: Record<string, any> | null;
  distance: number;
  score: number;
}

// ─── Embedding Local (HuggingFace Transformers.js) ───────────────────────────
let _pipeline: any = null;

async function getPipeline(): Promise<any> {
  if (_pipeline) return _pipeline;
  const mod = await import('@huggingface/transformers');
  const { pipeline, env } = mod;
  env.cacheDir = './.cache/huggingface';
  _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return _pipeline;
}

/**
 * Fonction d'embedding locale — implémente EmbeddingFunction de ChromaDB.
 */
export class LocalEmbeddingFunction implements EmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    const extractor = await getPipeline();
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }
}

let _localEmbedder: LocalEmbeddingFunction | null = null;

export function getLocalEmbedder(): LocalEmbeddingFunction {
  if (!_localEmbedder) _localEmbedder = new LocalEmbeddingFunction();
  return _localEmbedder;
}

// ─── Client ChromaDB Singleton ───────────────────────────────────────────────

let _chromaClient: any = null;

export async function getChromaClient(): Promise<ChromaClient> {
  if (!_chromaClient) {
    const { ChromaClient } = await import('chromadb');
    const chromaUrl = process.env.CHROMA_URL ?? 'http://127.0.0.1:8000';
    try {
      const url = new URL(chromaUrl);
      const ssl = url.protocol === 'https:';
      const host = url.hostname;
      const port = url.port ? parseInt(url.port) : (ssl ? 443 : 80);
      _chromaClient = new ChromaClient({ ssl, host, port });
    } catch {
      _chromaClient = new ChromaClient({ path: chromaUrl });
    }
  }
  return _chromaClient;
}

// ─── Collections ─────────────────────────────────────────────────────────────

export async function getOrCreateCollection(
  name: string,
  embeddingFunction: EmbeddingFunction = getLocalEmbedder()
): Promise<Collection> {
  const client = await getChromaClient();
  return client.getOrCreateCollection({ name, embeddingFunction });
}

export async function deleteCollection(name: string): Promise<void> {
  const client = await getChromaClient();
  await client.deleteCollection({ name });
}

export async function listCollections(): Promise<{ name: string }[]> {
  const client = await getChromaClient();
  return client.listCollections();
}

// ─── CRUD Documents ──────────────────────────────────────────────────────────

export async function addDocuments(
  collectionName: string,
  documents: DocumentToAdd[],
  embeddingFunction: EmbeddingFunction = getLocalEmbedder()
): Promise<void> {
  const col = await getOrCreateCollection(collectionName, embeddingFunction);
  await col.add({
    ids: documents.map((d) => d.id),
    documents: documents.map((d) => d.content),
    metadatas: documents.map((d) => d.metadata ?? {}),
  });
}

export async function upsertDocuments(
  collectionName: string,
  documents: DocumentToAdd[],
  embeddingFunction: EmbeddingFunction = getLocalEmbedder()
): Promise<void> {
  const col = await getOrCreateCollection(collectionName, embeddingFunction);
  await col.upsert({
    ids: documents.map((d) => d.id),
    documents: documents.map((d) => d.content),
    metadatas: documents.map((d) => d.metadata ?? {}),
  });
}

// ─── Recherche Sémantique ────────────────────────────────────────────────────

export async function semanticSearch(
  options: SearchOptions,
  embeddingFunction: EmbeddingFunction = getLocalEmbedder()
): Promise<SearchResult[]> {
  const { collectionName, query, nResults = 5, whereFilter } = options;
  const col = await getOrCreateCollection(collectionName, embeddingFunction);

  const queryParams: any = {
    queryTexts: [query],
    nResults,
  };

  if (whereFilter && Object.keys(whereFilter).length > 0) {
    queryParams.where = whereFilter;
  }

  const results = await col.query(queryParams);

  const ids = results.ids[0] ?? [];
  const docs = results.documents[0] ?? [];
  const metas = results.metadatas?.[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return ids.map((id, i) => {
    const dist = distances[i] ?? 0;
    return {
      id,
      document: docs[i] ?? '',
      metadata: (metas[i] as Record<string, any>) ?? null,
      distance: dist,
      score: parseFloat((1 - dist).toFixed(4)),
    };
  });
}

// ─── RAG INDUSTRIAL DOCUMENTS ────────────────────────────────────────────────

export const RAG_SAMPLE_DOCUMENTS: DocumentToAdd[] = [
  {
    id: 'manual-panel-valves',
    content: "Manuel technique d'entretien pour le Panneau de Contrôle. Vérification des vannes et manomètres.",
    metadata: { component: 'industrial-control', title: "Guide de Maintenance des Vannes", url: "/docs/maintenance_vannes.pdf" }
  },
  {
    id: 'manual-pump-troubleshoot',
    content: "Guide de dépannage pour la Pompe Centrifuge. Alignement d'arbre et lubrification.",
    metadata: { component: 'pump-system', title: "Dépannage Pompe HydroFlow", url: "/docs/depannage_pompe.pdf" }
  }
];

export async function seedIndustrialManuals(): Promise<void> {
  const collectionName = 'industrial_manuals';
  try {
    const collections = await listCollections();
    if (!collections.some(c => c.name === collectionName)) {
      await addDocuments(collectionName, RAG_SAMPLE_DOCUMENTS);
      console.log(`🌱 Seeding RAG terminé.`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Seeding ChromaDB non possible : ${error.message}`);
  }
}

export function fallbackSemanticSearch(
  query: string,
  nResults: number = 3,
  componentFilter?: string
): SearchResult[] {
  const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  
  const scored = RAG_SAMPLE_DOCUMENTS.map(doc => {
    if (componentFilter && doc.metadata?.component !== componentFilter) return { doc, score: 0 };
    
    let score = 0;
    const content = doc.content.toLowerCase();
    const title = (doc.metadata?.title as string || '').toLowerCase();
    
    queryTokens.forEach(token => {
      if (title.includes(token)) score += 3;
      if (content.includes(token)) score += 1;
    });
    
    return { doc, score };
  });
  
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, nResults)
    .map(item => ({
      id: item.doc.id,
      document: item.doc.content,
      metadata: item.doc.metadata || null,
      distance: 0,
      score: item.score
    }));
}

export async function getUserCollectionNames(): Promise<string[]> {
  try {
    const cols = await listCollections();
    return cols.map((c: any) => c.name);
  } catch {
    return ['industrial_manuals'];
  }
}

export async function searchAcrossCollections(
  query: string,
  nResultsPerCollection: number = 3
): Promise<SearchResult[]> {
  try {
    const collectionNames = await getUserCollectionNames();
    const searchPromises = collectionNames.map(name =>
      semanticSearch({ collectionName: name, query, nResults: nResultsPerCollection })
        .then(results => results.map(r => ({ ...r, metadata: { ...r.metadata, _collection: name } })))
        .catch(() => [] as SearchResult[])
    );

    const resultsPerCollection = await Promise.all(searchPromises);
    const allResults = resultsPerCollection.flat();

    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, nResultsPerCollection * 2);
  } catch {
    return fallbackSemanticSearch(query, nResultsPerCollection);
  }
}

export async function loadUserDatasetsFromDisk(): Promise<DocumentToAdd[]> {
  return []; // Fallback minimal pour éviter les erreurs FS côté client
}
