/**
 * @fileOverview Gestionnaire ChromaDB sécurisé pour l'environnement hybride.
 * Configure la persistance physique pour le développement local et Tauri.
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

// ─── INITIALISATION PHYSIQUE DES RÉPERTOIRES ────────────────────────────────
const CHROMA_DATA_DIR = path.join(process.cwd(), 'data', 'chromadb');
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
    console.warn("⚠️ [RAG_LOCAL] Pipeline embedding indisponible. Mode dégradé activé.");
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

/**
 * Récupère le client ChromaDB. 
 * En mode local, utilise le PersistentClient pour s'ancrer sur le répertoire physique.
 */
export async function getChromaClient(): Promise<any> {
  if (IS_CLOUD) return null;
  if (_chromaClient) return _chromaClient;
  try {
    // Import dynamique pour éviter de charger les modules lourds côté client
    const { ChromaClient } = await import('chromadb');
    
    // Si nous sommes dans l'IDE ou en mode Desktop, nous utilisons la persistance locale
    // Note: Certaines versions de chromadb utilisent PersistentClient, d'autres ChromaClient({ path })
    _chromaClient = new ChromaClient({ 
      path: `file://${CHROMA_DATA_DIR}` 
    });
    
    console.log(`🧠 [CHROMA_INIT] Moteur ancré sur : ${CHROMA_DATA_DIR}`);
    return _chromaClient;
  } catch (e: any) {
    console.error("❌ [CHROMA_INIT] Erreur de liaison physique :", e.message);
    return null;
  }
}

export async function listCollections() {
  if (IS_CLOUD) return [];
  try {
    const client = await getChromaClient();
    if (!client) return [];
    const collections = await client.listCollections();
    return collections;
  } catch {
    return [];
  }
}

export async function getOrCreateCollection(name: string, embeddingFunction: any = getLocalEmbedder()) {
  if (IS_CLOUD) throw new Error("FONCTIONNALITÉ_LOCALE_UNIQUEMENT");
  const client = await getChromaClient();
  if (!client) throw new Error("MOTEUR_LOCAL_INDISPONIBLE");
  return await client.getOrCreateCollection({ 
    name, 
    embeddingFunction 
  });
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
  } catch (e: any) {
    console.error(`❌ [BDD_CHROMA] Échec upsert : ${e.message}`);
  }
}

export async function semanticSearch(options: SearchOptions, embeddingFunction: any = getLocalEmbedder()): Promise<SearchResult[]> {
  if (IS_CLOUD) return [];
  const { collectionName, query, nResults = 5, whereFilter } = options;
  try {
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

    return ids.map((id: string, i: number) => ({
      id,
      document: String(docs[i] || ''),
      metadata: (metas[i] as any) || null,
      distance: Number(distances[i] || 0),
      score: parseFloat((1 - (Number(distances[i]) || 0)).toFixed(4))
    }));
  } catch (e: any) {
    return [];
  }
}

export async function searchAcrossCollections(query: string, nResultsPerCollection = 3): Promise<SearchResult[]> {
  if (IS_CLOUD) {
    try {
      const { getWeaviateClient } = await import('./weaviate-client');
      const client = await getWeaviateClient();
      const result = await client.graphql.get()
        .withClassName('Industrial_manuals')
        .withFields('question answer _additional { distance }')
        .withNearText({ concepts: [query] })
        .withLimit(nResultsPerCollection * 2)
        .do();
        
      const data = (result.data.Get as any)['Industrial_manuals'] || [];
      return data.map((item: any) => ({
        id: 'cloud-id',
        document: `Question: ${item.question}\nRéponse: ${item.answer}`,
        metadata: { provider: 'weaviate-cloud' },
        score: 1 - (item._additional?.distance || 0)
      }));
    } catch {
      return [];
    }
  }

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

/**
 * Initialisation automatique des manuels pour la démonstration.
 */
export async function seedIndustrialManuals() {
  if (IS_CLOUD) return;
  try {
    const collections = await listCollections();
    if (collections.some((c: any) => c.name === 'industrial_manuals')) return;

    console.log("📥 [SEED] Initialisation des manuels industriels locaux...");
    const docs = [
      { id: 'man-001', content: 'Le panneau de contrôle Alpha nécessite une pression de 5 bars.', metadata: { component: 'industrial-control', title: 'Manuel Alpha' } },
      { id: 'man-002', content: 'La pompe centrifuge Beta doit être lubrifiée tous les 6 mois.', metadata: { component: 'pump-system', title: 'Maintenance Beta' } }
    ];
    await addDocuments('industrial_manuals', docs);
  } catch (e) {
    console.error("❌ [SEED] Échec :", e);
  }
}
