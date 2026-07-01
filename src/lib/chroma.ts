/**
 * @fileOverview Moteur de recherche professionnel VisioNode Pro-Search V5.3.
 * Version : Support de listage des collections pour l'Explorateur BDD.
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

const STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'ce', 'ces', 'pour', 'sur', 'dans', 'avec', 'est', 'sont']);

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
  } catch (e) {}
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

export function fallbackSemanticSearch(query: string, nResults = 5, componentFilter?: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryTokens = tokenize(query);
  const lowerQuery = query.toLowerCase().trim();
  const isVisualRequest = lowerQuery.includes('photo') || lowerQuery.includes('image');

  if (fs.existsSync(REGISTRY_ITEMS_DIR)) {
    try {
      const files = fs.readdirSync(REGISTRY_ITEMS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(REGISTRY_ITEMS_DIR, file), 'utf8');
        const data = JSON.parse(content);
        let score = 0;
        const searchSpace = `${data.title} ${data.label} ${data.details} ${data.content}`.toLowerCase();
        
        if (searchSpace.includes(lowerQuery)) score += 50;
        queryTokens.forEach(token => { if (searchSpace.includes(token)) score += 10; });

        if (score > 5) {
          const procedureId = data.procedureId || data.knowledgeId || (file.startsWith('proc-') ? file.replace('.json', '') : undefined);
          
          results.push({
            id: file,
            document: `${data.label || data.title || ''}\n${data.details || data.content || ''}`,
            metadata: { 
              ...data.metadata, 
              title: data.title, 
              origin: 'PHY_REGISTRY', 
              relPath: `items/${file}`,
              procedureId: procedureId,
              type: data.type || (procedureId ? 'procedure' : 'text')
            },
            distance: 0,
            score: Math.min(score / 100, 0.95)
          });
        }
      }
    } catch (e) {}
  }

  if (fs.existsSync(REGISTRY_BANK_DIR)) {
    try {
      const folders = fs.readdirSync(REGISTRY_BANK_DIR);
      for (const folder of folders) {
        const metaPath = path.join(REGISTRY_BANK_DIR, folder, 'metadata.json');
        if (!fs.existsSync(metaPath)) continue;
        const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const searchSpace = `${data.name} ${data.description} ${data.tags?.join(' ')}`.toLowerCase();
        let score = 0;
        if (searchSpace.includes(lowerQuery)) score += 80;
        if (isVisualRequest) score += 50;

        if (score > 10) {
          results.push({
            id: folder,
            document: `[ACTIF_BANQUE]: ${data.name}\n${data.description}`,
            metadata: { ...data, origin: 'PHY_BANK', relPath: data.path, isMedia: true, mediaType: data.type },
            distance: 0,
            score: Math.min(score / 150, 1)
          });
        }
      }
    } catch (e) {}
  }

  return results.sort((a, b) => b.score - a.score).slice(0, nResults);
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
  try {
    const client = await getChromaClient();
    if (!client) return [];
    return await client.listCollections();
  } catch (e) {
    console.error("❌ [CHROMA_LIST]", e);
    return [];
  }
}

export async function deleteCollection(name: string) {
  if (IS_CLOUD) return;
  try {
    const client = await getChromaClient();
    if (client) await client.deleteCollection({ name });
  } catch (e) {
    console.error("❌ [CHROMA_DELETE]", e);
  }
}

export async function getOrCreateCollection(name: string, embeddingFunction?: any) {
  if (IS_CLOUD) throw new Error("CHROMA_NOT_AVAILABLE_ON_CLOUD");
  const client = await getChromaClient();
  return await client.getOrCreateCollection({ 
    name, 
    embeddingFunction: embeddingFunction || new LocalEmbeddingFunction() 
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
    console.error(`❌ [CHROMA_UPSERT] ${e.message}`);
  }
}

export async function semanticSearch(options: SearchOptions, embeddingFunction?: any): Promise<SearchResult[]> {
  if (IS_CLOUD) return [];
  try {
    const col = await getOrCreateCollection(options.collectionName, embeddingFunction);
    const results = await col.query({
      queryTexts: [options.query],
      nResults: options.nResults || 5,
      where: options.whereFilter
    });
    
    const formatted: SearchResult[] = [];
    if (results.ids[0]) {
      results.ids[0].forEach((id: string, i: number) => {
        formatted.push({
          id,
          document: String(results.documents[0][i]),
          metadata: results.metadatas[0][i],
          distance: Number(results.distances?.[0][i] || 0),
          score: 1 - Number(results.distances?.[0][i] || 0)
        });
      });
    }
    return formatted;
  } catch (e) {
    return [];
  }
}

export async function searchAcrossCollections(query: string, nResults = 5): Promise<SearchResult[]> {
  const mergedResults: SearchResult[] = [];
  const physical = fallbackSemanticSearch(query, nResults);
  mergedResults.push(...physical);

  if (!IS_CLOUD) {
    try {
      const collections = await listCollections();
      for (const c of collections) {
        const results = await semanticSearch({ collectionName: c.name, query, nResults });
        results.forEach(r => {
          mergedResults.push({
            ...r,
            metadata: { ...r.metadata, origin: 'VEC_CHROMA' }
          });
        });
      }
    } catch (e) {}
  }

  const unique = Array.from(new Map(mergedResults.map(r => [r.document.toLowerCase().trim(), r])).values());
  return unique.sort((a, b) => b.score - a.score).slice(0, nResults);
}

export async function seedIndustrialManuals() {
  if (IS_CLOUD) return;
  const docs = [
    { id: 'man-001', content: 'Panneau Alpha: Pression de service 5 bars.', metadata: { component: 'industrial-control' } },
    { id: 'man-002', content: 'Pompe CRF: Température palier max 90°C.', metadata: { component: 'pump-system' } }
  ];
  await upsertDocuments('industrial_manuals', docs);
}
