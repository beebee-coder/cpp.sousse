
/**
 * @fileOverview Gestionnaire ChromaDB sécurisé pour l'environnement hybride.
 * Les bibliothèques lourdes sont importées dynamiquement pour éviter les erreurs de bundle client
 * et réduire la taille des fonctions serverless sur Vercel.
 */

import type { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';

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

// ─── Embedding Local ──────────────────────────────────────────────────────────
let _pipeline: any = null;

async function getPipeline(): Promise<any> {
  // Sur Vercel, on ne charge jamais le pipeline local (trop lourd)
  if (process.env.VERCEL) return null;
  
  if (_pipeline) return _pipeline;
  try {
    const { pipeline } = await import('@huggingface/transformers');
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return _pipeline;
  } catch (e) {
    console.error("Échec chargement pipeline embedding local:", e);
    return null;
  }
}

export class LocalEmbeddingFunction implements EmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    const extractor = await getPipeline();
    if (!extractor) return texts.map(() => []);
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
  if (_chromaClient) return _chromaClient;
  
  // Import dynamique pour éviter d'inclure chromadb dans le bundle cloud
  const { ChromaClient } = await import('chromadb');
  const chromaUrl = process.env.CHROMA_URL ?? 'http://127.0.0.1:8000';
  
  try {
    const url = new URL(chromaUrl);
    _chromaClient = new ChromaClient({ 
      ssl: url.protocol === 'https:', 
      host: url.hostname, 
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80) 
    });
  } catch {
    _chromaClient = new ChromaClient({ path: chromaUrl });
  }
  return _chromaClient;
}

export async function listCollections() {
  const client = await getChromaClient();
  return client.listCollections();
}

export async function getOrCreateCollection(name: string, embeddingFunction: EmbeddingFunction = getLocalEmbedder()) {
  const client = await getChromaClient();
  return client.getOrCreateCollection({ name, embeddingFunction });
}

export async function deleteCollection(name: string) {
  const client = await getChromaClient();
  return client.deleteCollection({ name });
}

export async function addDocuments(collectionName: string, documents: DocumentToAdd[], embeddingFunction: EmbeddingFunction = getLocalEmbedder()) {
  const col = await getOrCreateCollection(collectionName, embeddingFunction);
  await col.add({
    ids: documents.map(d => d.id),
    documents: documents.map(d => d.content),
    metadatas: documents.map(d => d.metadata ?? {})
  });
}

export async function upsertDocuments(collectionName: string, documents: DocumentToAdd[]) {
  const col = await getOrCreateCollection(collectionName);
  await col.upsert({
    ids: documents.map(d => d.id),
    documents: documents.map(d => d.content),
    metadatas: documents.map(d => d.metadata ?? {})
  });
}

export async function semanticSearch(options: SearchOptions, embeddingFunction: EmbeddingFunction = getLocalEmbedder()): Promise<SearchResult[]> {
  const { collectionName, query, nResults = 5, whereFilter } = options;
  const col = await getOrCreateCollection(collectionName, embeddingFunction);
  
  const results = await col.query({
    queryTexts: [query],
    nResults,
    where: whereFilter as any
  });

  const ids = results.ids[0] ?? [];
  const docs = results.documents[0] ?? [];
  const metas = results.metadatas?.[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return ids.map((id, i) => ({
    id,
    document: String(docs[i] || ''),
    metadata: (metas[i] as any) || null,
    distance: Number(distances[i] || 0),
    score: parseFloat((1 - (Number(distances[i]) || 0)).toFixed(4))
  }));
}

export async function seedIndustrialManuals() {
  const timestamp = new Date().toLocaleTimeString();
  try {
    const collectionName = 'industrial_manuals';
    const col = await getOrCreateCollection(collectionName);
    const count = await col.count();
    
    if (count === 0) {
      console.log(`🌱 [${timestamp}] [CHROMA] Peuplement initial des manuels industriels...`);
      const seedData: DocumentToAdd[] = [
        {
          id: 'man-001',
          content: 'Procédure de maintenance du panneau de contrôle : Vérifier les vannes de pression et l\'état du bouton d\'arrêt d\'urgence.',
          metadata: { title: 'Manuel Panneau de Contrôle', component: 'industrial-control', url: '/docs/control-panel.pdf' }
        },
        {
          id: 'man-002',
          content: 'Guide d\'entretien pompe centrifuge : Lubrification des roulements toutes les 500 heures. Inspection visuelle des brides.',
          metadata: { title: 'Manuel Pompe Centrifuge', component: 'pump-system', url: '/docs/pump-guide.pdf' }
        },
        {
          id: 'man-003',
          content: 'Sécurité ligne de production : Les bras robotiques doivent être calibrés hebdomadairement. Vérifier les capteurs de proximité.',
          metadata: { title: 'Sécurité Robotique', component: 'factory-floor', url: '/docs/safety-robot.pdf' }
        }
      ];
      await addDocuments(collectionName, seedData);
      console.log(`✅ [${timestamp}] [CHROMA] 3 manuels indexés.`);
    }
  } catch (e) {
    console.warn(`⚠️ [${timestamp}] [CHROMA] Échec ou saut du peuplement :`, e);
  }
}

export function fallbackSemanticSearch(query: string, nResults = 3, componentFilter?: string): SearchResult[] {
  return []; 
}

export async function searchAcrossCollections(query: string, nResultsPerCollection = 3): Promise<SearchResult[]> {
  try {
    const cols = await listCollections();
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
