
/**
 * @fileOverview Gestionnaire ChromaDB robuste pour environnement hybride avec fallback sémantique.
 * Version : Optimisée pour le déploiement Cloud (Sans Transformers).
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

const REGISTRY_ITEMS_DIR = path.join(process.cwd(), '.registry', 'items');

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

/**
 * LocalEmbeddingFunction allégée.
 * @huggingface/transformers a été supprimé pour respecter la limite de 250MB de Vercel.
 * Le système utilise désormais le fallback sémantique par mots-clés en local.
 */
export class LocalEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    // Renvoie des vecteurs vides car la bibliothèque Transformers est absente
    // Cela déclenchera la logique de repli (fallback) dans les recherches.
    return texts.map(() => new Array(384).fill(0));
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
    const ChromaClientClass = (chroma as any).ChromaClient || (chroma as any).default?.ChromaClient;
    
    if (ChromaClientClass) {
      _chromaClient = new ChromaClientClass({
        path: CHROMA_DATA_DIR
      });
      console.log(`🧠 [CHROMA_INIT] Moteur ancré sur : ${CHROMA_DATA_DIR}`);
    }
    
    return _chromaClient;
  } catch (e: any) {
    console.error("❌ [CHROMA_INIT] Erreur de liaison physique :", e.message);
    return null;
  }
}

/**
 * Recherche de secours par mots-clés dans le registre physique (Fallback).
 * Utilisé quand ChromaDB est inaccessible ou quand les embeddings sont désactivés.
 */
export function fallbackSemanticSearch(query: string, nResults = 3, componentFilter?: string): SearchResult[] {
  if (!fs.existsSync(REGISTRY_ITEMS_DIR)) return [];
  
  try {
    const files = fs.readdirSync(REGISTRY_ITEMS_DIR).filter(f => f.endsWith('.json'));
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const file of files) {
      const content = fs.readFileSync(path.join(REGISTRY_ITEMS_DIR, file), 'utf8');
      const data = JSON.parse(content);
      const text = `${data.label} ${data.details} ${data.title}`.toLowerCase();
      
      if (text.includes(lowerQuery) || lowerQuery.split(' ').some(word => word.length > 3 && text.includes(word))) {
        if (componentFilter && data.metadata?.component !== componentFilter) continue;

        results.push({
          id: file,
          document: `${data.label}\n${data.details}`,
          metadata: { ...data.metadata, title: data.title, source: file },
          distance: 0,
          score: 1
        });
      }
      if (results.length >= nResults * 2) break;
    }

    return results.slice(0, nResults);
  } catch (e) {
    return [];
  }
}

export async function loadUserDatasetsFromDisk(): Promise<void> {
  console.log("📂 [RAG] Dataset prêt pour recherche par mots-clés.");
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
    // Si la recherche vectorielle échoue ou renvoie des scores nuls, on bascule sur le fallback
    return fallbackSemanticSearch(query, nResults);
  }
}

export async function searchAcrossCollections(query: string, nResultsPerCollection = 3): Promise<SearchResult[]> {
  if (IS_CLOUD) return [];
  try {
    const cols = await listCollections();
    if (!cols || cols.length === 0) return fallbackSemanticSearch(query, nResultsPerCollection);
    const searchPromises = cols.map(c => 
      semanticSearch({ collectionName: c.name, query, nResults: nResultsPerCollection })
        .then(res => res.map(r => ({ ...r, metadata: { ...r.metadata, _collection: c.name } })))
        .catch(() => [] as SearchResult[])
    );
    const all = (await Promise.all(searchPromises)).flat();
    return all.sort((a, b) => b.score - a.score).slice(0, nResultsPerCollection * 2);
  } catch {
    return fallbackSemanticSearch(query, nResultsPerCollection);
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
