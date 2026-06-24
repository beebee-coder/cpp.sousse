
/**
 * @fileOverview Gestionnaire ChromaDB robuste pour environnement hybride.
 */

import path from 'path';
import fs from 'fs';

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

const CHROMA_DATA_DIR = path.join(process.cwd(), '.data', 'chromadb');
if (!fs.existsSync(CHROMA_DATA_DIR)) {
  fs.mkdirSync(CHROMA_DATA_DIR, { recursive: true });
}

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

let _pipeline: any = null;

async function getPipeline(): Promise<any> {
  if (IS_CLOUD) return null; 
  if (_pipeline) return _pipeline;
  try {
    const { pipeline } = await import('@huggingface/transformers');
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return _pipeline;
  } catch (e) {
    return null;
  }
}

export class LocalEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    if (IS_CLOUD) return texts.map(() => []);
    const extractor = await getPipeline();
    if (!extractor) return texts.map(() => []);
    try {
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      return output.tolist() as number[][];
    } catch (e) {
      return texts.map(() => []);
    }
  }
}

let _localEmbedder: LocalEmbeddingFunction | null = null;
export function getLocalEmbedder(): LocalEmbeddingFunction {
  if (!_localEmbedder) _localEmbedder = new LocalEmbeddingFunction();
  return _localEmbedder;
}

let _chromaClient: any = null;

export async function getChromaClient(): Promise<any> {
  if (IS_CLOUD) return null;
  if (_chromaClient) return _chromaClient;
  try {
    const chroma = await import('chromadb');
    // Détection dynamique du constructeur selon la version installée
    const ClientClass = (chroma as any).PersistentClient || (chroma as any).ChromaClient;
    if (ClientClass) {
      _chromaClient = new ClientClass({ path: CHROMA_DATA_DIR });
    }
    return _chromaClient;
  } catch (e: any) {
    return null;
  }
}

export async function deleteCollection(name: string) {
  if (IS_CLOUD) return;
  try {
    const client = await getChromaClient();
    if (client) await client.deleteCollection({ name });
  } catch (e) {}
}

export async function listCollections() {
  if (IS_CLOUD) return [];
  try {
    const client = await getChromaClient();
    if (!client) return [];
    return await client.listCollections();
  } catch {
    return [];
  }
}

export async function getOrCreateCollection(name: string, embeddingFunction: any = getLocalEmbedder()) {
  if (IS_CLOUD) throw new Error("LOCAL_ONLY");
  const client = await getChromaClient();
  if (!client) throw new Error("CHROMA_UNAVAILABLE");
  return await client.getOrCreateCollection({ name, embeddingFunction });
}

export async function addDocuments(collectionName: string, documents: DocumentToAdd[], embeddingFunction: any = getLocalEmbedder()) {
  if (IS_CLOUD) return;
  const col = await getOrCreateCollection(collectionName, embeddingFunction);
  await col.add({
    ids: documents.map(d => d.id),
    documents: documents.map(d => d.content),
    metadatas: documents.map(d => d.metadata ?? {})
  });
}

export async function upsertDocuments(collectionName: string, documents: DocumentToAdd[]) {
  if (IS_CLOUD) return;
  try {
    const col = await getOrCreateCollection(collectionName);
    await col.upsert({
      ids: documents.map(d => d.id),
      documents: documents.map(d => d.content),
      metadatas: documents.map(d => d.metadata ?? {})
    });
  } catch (e) {}
}

export async function semanticSearch(options: SearchOptions, embeddingFunction: any = getLocalEmbedder()): Promise<SearchResult[]> {
  if (IS_CLOUD) return [];
  const { collectionName, query, nResults = 5, whereFilter } = options;
  try {
    const col = await getOrCreateCollection(collectionName, embeddingFunction);
    const results = await col.query({ queryTexts: [query], nResults, where: whereFilter as any });
    const ids = results.ids[0] ?? [];
    const docs = results.documents[0] ?? [];
    const distances = results.distances?.[0] ?? [];
    return ids.map((id: string, i: number) => ({
      id,
      document: String(docs[i] || ''),
      metadata: (results.metadatas?.[0]?.[i] as any) || null,
      distance: Number(distances[i] || 0),
      score: parseFloat((1 - (Number(distances[i]) || 0)).toFixed(4))
    }));
  } catch (e) {
    return [];
  }
}

export async function searchAcrossCollections(query: string, nResultsPerCollection = 3): Promise<SearchResult[]> {
  if (IS_CLOUD) return [];
  try {
    const cols = await listCollections();
    if (!cols || cols.length === 0) return [];
    const searchPromises = cols.map(c => 
      semanticSearch({ collectionName: c.name, query, nResults: nResultsPerCollection })
        .then(res => res.map(r => ({ ...r, metadata: { ...r.metadata, _collection: c.name } })))
        .catch(() => [] as SearchResult[])
    );
    const all = (await Promise.all(searchPromises)).flat();
    return all.sort((a, b) => b.score - a.score).slice(0, nResultsPerCollection * 2);
  } catch {
    return [];
  }
}

export async function seedIndustrialManuals() {
  if (IS_CLOUD) return;
  try {
    const collections = await listCollections();
    if (collections.some((c: any) => c.name === 'industrial_manuals')) return;
    const docs = [
      { id: 'man-001', content: 'Panneau Alpha: Pression 5 bars.', metadata: { component: 'industrial-control', title: 'Manuel Alpha' } },
      { id: 'man-002', content: 'Pompe Beta: Lubrification 6 mois.', metadata: { component: 'pump-system', title: 'Maintenance Beta' } }
    ];
    await addDocuments('industrial_manuals', docs);
  } catch (e) {}
}
