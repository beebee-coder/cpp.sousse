
/**
 * @fileOverview Gestionnaire ChromaDB robuste pour environnement hybride avec fallback sémantique.
 * Version : Optimisée pour la fusion de données RAG et Registre.
 */

import path from 'path';
import fs from 'fs';

export interface DocumentToAdd {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  collectionName: string;
  query: string;
  nResults?: number;
  whereFilter?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  document: string;
  metadata: Record<string, any> | null;
  distance: number;
  score: number;
}

const CHROMA_DATA_DIR = path.join(process.cwd(), '.data', 'chromadb');
const REGISTRY_ITEMS_DIR = path.join(process.cwd(), '.registry', 'items');
const REGISTRY_BANK_DIR = path.join(process.cwd(), '.registry', 'bank');

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

/**
 * Génère un résumé de l'état actuel des connaissances du système.
 */
export async function getSystemContextSummary() {
  const summary = {
    ragDocuments: 0,
    bankAssets: 0,
    mode: IS_CLOUD ? 'CLOUD_DISTRIBUÉ' : 'STATION_LOCALE_FORGE',
  };

  try {
    if (fs.existsSync(REGISTRY_ITEMS_DIR)) {
      summary.ragDocuments = fs.readdirSync(REGISTRY_ITEMS_DIR).filter(f => f.endsWith('.json')).length;
    }
    if (fs.existsSync(REGISTRY_BANK_DIR)) {
      summary.bankAssets = fs.readdirSync(REGISTRY_BANK_DIR).length;
    }
  } catch (e) {
    console.warn("Échec récupération sommaire contexte.");
  }

  return summary;
}

export class LocalEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
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
    }
    return _chromaClient;
  } catch (e: any) {
    return null;
  }
}

/**
 * Recherche textuelle robuste dans le registre physique.
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
      const text = `${data.label || ''} ${data.details || ''} ${data.title || ''}`.toLowerCase();
      
      // Recherche par mots-clés (Fallback sémantique léger)
      if (text.includes(lowerQuery) || lowerQuery.split(' ').some(word => word.length > 3 && text.includes(word))) {
        if (componentFilter && data.metadata?.component !== componentFilter) continue;

        results.push({
          id: file,
          document: `${data.label || ''}\n${data.details || ''}`,
          metadata: { ...data.metadata, title: data.title, source: file, origin: 'PHY_REGISTRY' },
          distance: 0,
          score: 1 // Score maximal pour match exact par mots-clés
        });
      }
      if (results.length >= nResults * 3) break;
    }
    return results.slice(0, nResults).sort((a, b) => b.score - a.score);
  } catch (e) {
    return [];
  }
}

export async function loadUserDatasetsFromDisk(): Promise<void> {
  // Fonction de compatibilité
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

export async function upsertDocuments(collectionName: string, documents: DocumentToAdd[], embeddingFunction: any = getLocalEmbedder()) {
  if (IS_CLOUD) return;
  try {
    const col = await getOrCreateCollection(collectionName, embeddingFunction);
    await col.upsert({
      ids: documents.map(d => d.id),
      documents: documents.map(d => d.content),
      metadatas: documents.map(d => d.metadata ?? {})
    });
  } catch (e) {}
}

export async function addDocuments(collectionName: string, documents: DocumentToAdd[], embeddingFunction: any = getLocalEmbedder()) {
  return await upsertDocuments(collectionName, documents, embeddingFunction);
}

export async function semanticSearch(options: SearchOptions, embeddingFunction: any = getLocalEmbedder()): Promise<SearchResult[]> {
  if (IS_CLOUD) return fallbackSemanticSearch(options.query, options.nResults);
  
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
      metadata: { ...(results.metadatas?.[0]?.[i] as any || {}), origin: 'VEC_CHROMA' },
      distance: Number(distances[i] || 0),
      score: parseFloat((1 - (Number(distances[i]) || 0)).toFixed(4))
    }));
  } catch (e) {
    return fallbackSemanticSearch(query, nResults);
  }
}

/**
 * Recherche fusionnée : Vectoriel + Physique pour optimiser les réponses IA.
 */
export async function searchAcrossCollections(query: string, nResultsPerCollection = 3): Promise<SearchResult[]> {
  const mergedResults: SearchResult[] = [];

  // 1. Recherche Physique (Registre) - Toujours active car ultra-rapide
  const physical = fallbackSemanticSearch(query, nResultsPerCollection);
  mergedResults.push(...physical);

  // 2. Recherche Vectorielle (Si disponible)
  if (!IS_CLOUD) {
    try {
      const cols = await listCollections() as any[];
      if (cols && cols.length > 0) {
        const searchPromises = cols.map((c: any) => 
          semanticSearch({ collectionName: c.name, query, nResults: nResultsPerCollection })
            .catch(() => [] as SearchResult[])
        );
        const vectorDocs = (await Promise.all(searchPromises)).flat();
        mergedResults.push(...vectorDocs);
      }
    } catch (e) {}
  }

  // 3. Déduplication et Tri par score
  const unique = Array.from(new Map(mergedResults.map(r => [r.document.substring(0, 100), r])).values());
  return unique.sort((a, b) => b.score - a.score).slice(0, nResultsPerCollection * 2);
}

export async function seedIndustrialManuals() {
  if (IS_CLOUD) return;
  try {
    const collections = await listCollections();
    if (collections.some((c: any) => c.name === 'industrial_manuals')) return;
    const docs = [
      { id: 'man-001', content: 'Panneau Alpha: Pression de service nominale 5 bars.', metadata: { component: 'industrial-control', title: 'Manuel Alpha' } },
      { id: 'man-002', content: 'Pompe Beta: Fréquence de lubrification recommandée tous les 6 mois.', metadata: { component: 'pump-system', title: 'Maintenance Beta' } }
    ];
    await upsertDocuments('industrial_manuals', docs);
  } catch (e) {}
}
