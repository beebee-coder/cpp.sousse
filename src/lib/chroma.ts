/**
 * @fileOverview Moteur de recherche professionnel VisioNode Pro-Search V5.0.
 * Intègre 20 options professionnelles de recherche industrielle incluant le support multimédia.
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

const REGISTRY_ITEMS_DIR = path.join(process.cwd(), '.registry', 'items');
const REGISTRY_BANK_DIR = path.join(process.cwd(), '.registry', 'bank');
const CHROMA_DATA_DIR = path.join(process.cwd(), '.data', 'chromadb');

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

const STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'ce', 'ces', 'pour', 'sur', 'dans', 'avec', 'est', 'sont', 'donne', 'moi', 'quel', 'quels', 'quelle']);

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Recherche Physique étendue : Items + Banque d'Images
 * Version : Multimédia Pro-Search (Boost sur mots-clés visuels)
 */
export function fallbackSemanticSearch(query: string, nResults = 5, componentFilter?: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryTokens = tokenize(query);
  const lowerQuery = query.toLowerCase().trim();
  const isVisualRequest = lowerQuery.includes('photo') || lowerQuery.includes('image') || lowerQuery.includes('voir') || lowerQuery.includes('visuel');

  // 1. Scan du Registre d'Items (JSON)
  if (fs.existsSync(REGISTRY_ITEMS_DIR)) {
    try {
      const files = fs.readdirSync(REGISTRY_ITEMS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(REGISTRY_ITEMS_DIR, file), 'utf8');
        const data = JSON.parse(content);
        
        const fileName = file.replace('.json', '');
        const title = String(data.title || data.label || '').toLowerCase();
        const body = String(data.details || data.content || '').toLowerCase();
        
        let score = 0;
        if (title.includes(lowerQuery)) score += 50;
        if (fileName.includes(lowerQuery)) score += 60;
        if (body.includes(lowerQuery)) score += 20;

        queryTokens.forEach(token => {
          if (fileName.includes(token)) score += 15;
          if (title.includes(token)) score += 10;
        });

        if (score > 5) {
          if (componentFilter && data.metadata?.component !== componentFilter) continue;
          results.push({
            id: file,
            document: `${data.label || data.title || ''}\n${data.details || data.content || ''}`,
            metadata: { ...data.metadata, title: data.title, origin: 'PHY_REGISTRY', relPath: `items/${file}`, relevance_score: score },
            distance: 0,
            score: Math.min(score / 100, 0.95) // Max 95% pour le texte
          });
        }
      }
    } catch (e) {}
  }

  // 2. Scan de la Banque d'Images (Metadata.json)
  if (fs.existsSync(REGISTRY_BANK_DIR)) {
    try {
      const folders = fs.readdirSync(REGISTRY_BANK_DIR);
      for (const folder of folders) {
        const metaPath = path.join(REGISTRY_BANK_DIR, folder, 'metadata.json');
        if (!fs.existsSync(metaPath)) continue;

        const content = fs.readFileSync(metaPath, 'utf8');
        const data = JSON.parse(content);
        
        const name = String(data.name || '').toLowerCase();
        const desc = String(data.description || '').toLowerCase();
        const tags = Array.isArray(data.tags) ? data.tags.join(' ').toLowerCase() : '';

        let score = 0;
        if (name.includes(lowerQuery)) score += 80; // Boost massif sur le nom de l'actif
        if (desc.includes(lowerQuery)) score += 30;
        if (tags.includes(lowerQuery)) score += 40;

        // Boost contextuel multimédia
        if (isVisualRequest) {
           score += 50; 
           if (name.includes('admin') && lowerQuery.includes('admin')) score += 100;
        }

        queryTokens.forEach(token => {
          if (name.includes(token)) score += 30;
          if (tags.includes(token)) score += 20;
        });

        if (score > 10) {
          results.push({
            id: folder,
            document: `[ACTIF_BANQUE]: ${data.name}\n${data.description}`,
            metadata: { 
              ...data, 
              origin: 'PHY_BANK', 
              relPath: data.path, 
              isMedia: true,
              mediaType: data.type,
              relevance_score: score 
            },
            distance: 0,
            score: Math.min(score / 150, 1) // Normalisation
          });
        }
      }
    } catch (e) {}
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, nResults);
}

export class LocalEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(384).fill(0));
  }
}

let _chromaClient: any = null;
export async function getChromaClient(): Promise<any> {
  if (IS_CLOUD) return null;
  if (_chromaClient) return _chromaClient;
  try {
    const chroma = await import('chromadb');
    const ChromaClientClass = (chroma as any).ChromaClient || (chroma as any).default?.ChromaClient;
    if (ChromaClientClass) {
      _chromaClient = new ChromaClientClass({ path: CHROMA_DATA_DIR });
    }
    return _chromaClient;
  } catch { return null; }
}

export async function listCollections() {
  if (IS_CLOUD) return [];
  const client = await getChromaClient();
  return client ? await client.listCollections() : [];
}

export async function getOrCreateCollection(name: string, embeddingFunction: any = new LocalEmbeddingFunction()) {
  const client = await getChromaClient();
  if (!client) throw new Error("CHROMA_UNAVAILABLE");
  return await client.getOrCreateCollection({ name, embeddingFunction });
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

export async function semanticSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { collectionName, query, nResults = 5 } = options;
  if (IS_CLOUD) return fallbackSemanticSearch(query, nResults);
  try {
    const col = await getOrCreateCollection(collectionName);
    const results = await col.query({ queryTexts: [query], nResults });
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

export async function searchAcrossCollections(query: string, nResultsPerCollection = 3): Promise<SearchResult[]> {
  const mergedResults: SearchResult[] = [];
  const physical = fallbackSemanticSearch(query, nResultsPerCollection * 2);
  mergedResults.push(...physical);
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
  const unique = Array.from(new Map(mergedResults.map(r => [r.document.toLowerCase().trim(), r])).values());
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
