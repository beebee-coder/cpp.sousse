/**
 * @fileOverview Moteur de recherche professionnel VisioNode Pro-Search V5.3.
 * Version : Support de listage des collections pour l'Explorateur BDD.
 */

import path from 'path';
import fs from 'fs';
import { IS_CLOUD } from './config/env';
import { tokenizeFr } from '@/lib/ai/tokenizer';

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

// R1 — Aligné sur la racine Rust via REGISTRY_ROOT_OVERRIDE (Desktop).
const REGISTRY_OVERRIDE = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
const REGISTRY_ROOT = REGISTRY_OVERRIDE ? REGISTRY_OVERRIDE : path.join(process.cwd(), '.registry');
const REGISTRY_ITEMS_DIR = path.join(REGISTRY_ROOT, 'items');
const REGISTRY_BANK_DIR = path.join(REGISTRY_ROOT, 'bank');
const LOCAL_DB_INDEX_CHROMA_DIR = path.join(process.cwd(), '.local-db', 'INDEX_CHROMA');

// "Cloud" = Vercel serverless (FS read-only, pas de Chroma local).
// Le build desktop (EXE Tauri) tourne en NODE_ENV=production mais reste une
// STATION LOCALE : il utilise le stockage vectoriel EMBARQUÉ (sans serveur/
// sans Python), voir embedded-vector-store.ts.

export async function getSystemContextSummary() {
  const summary = {
    ragDocuments: 0,
    bankAssets: 0,
    localDBFiles: 0,
    mode: IS_CLOUD ? 'CLOUD_DISTRIBUÉ' : 'STATION_LOCALE_FORGE',
  };
  try {
    if (fs.existsSync(REGISTRY_ITEMS_DIR)) {
      summary.ragDocuments = fs.readdirSync(REGISTRY_ITEMS_DIR).filter(f => f.endsWith('.json')).length;
    }
    if (fs.existsSync(REGISTRY_BANK_DIR)) {
      summary.bankAssets = fs.readdirSync(REGISTRY_BANK_DIR).length;
    }
    if (fs.existsSync(LOCAL_DB_INDEX_CHROMA_DIR)) {
      const files = fs.readdirSync(LOCAL_DB_INDEX_CHROMA_DIR, { recursive: true, withFileTypes: false }) as string[];
      summary.localDBFiles = files.filter(f => f.endsWith('.json')).length;
    }
  } catch (e: any) {
    console.warn('[CHROMA_SYSTEM_SUMMARY]', e.message);
  }
  return summary;
}

function tokenize(text: string): string[] {
  return tokenizeFr(text);
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
            score: Math.min(score / 100, 0.98)
          });
        }
      }
    } catch (e: any) {
      console.warn('[CHROMA_INDEX_SCAN]', e.message);
    }
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
    } catch (e: any) {
      console.warn('[CHROMA_INDEX_SCAN]', e.message);
    }
  }

  if (fs.existsSync(LOCAL_DB_INDEX_CHROMA_DIR)) {
    try {
      const scanForJson = (dir: string, baseRel: string) => {
        let jsonFiles: string[] = [];
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const abs = path.join(dir, item.name);
          const rel = path.posix.join(baseRel, item.name).replace(/\\/g, '/');
          if (item.isDirectory()) {
            jsonFiles = jsonFiles.concat(scanForJson(abs, rel));
          } else if (item.name.endsWith('.json')) {
            jsonFiles.push(rel);
          }
        }
        return jsonFiles;
      };

      const jsonFiles = scanForJson(LOCAL_DB_INDEX_CHROMA_DIR, '');
      for (const relFile of jsonFiles) {
        const fullPath = path.join(LOCAL_DB_INDEX_CHROMA_DIR, relFile);
        const content = fs.readFileSync(fullPath, 'utf8');
        let score = 0;
        if (content.toLowerCase().includes(lowerQuery)) score += 60;
        queryTokens.forEach(token => { if (content.toLowerCase().includes(token)) score += 10; });

        if (score > 5) {
          const knowledgeType = relFile.includes('procedure') ? 'procedure' : 'qa';
          results.push({
            id: relFile,
            document: `[LOCAL_DB]: ${path.basename(relFile)}\n${content.slice(0, 500)}`,
            metadata: {
              origin: 'LOCAL_DB_INDEX',
              relPath: relFile,
              type: knowledgeType
            },
            distance: 0,
            score: Math.min(score / 100, 0.98)
          });
        }
      }
    } catch (e: any) {
      console.warn('[CHROMA_INDEX_SCAN]', e.message);
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, nResults);
}

/**
 * Fonction d'embedding locale, déterministe et sans dépendance externe.
 *
 * Implémentation bag-of-words hashé (FNV-1a) sur 384 dimensions, L2-normalisé.
 * Ce n'est PAS un modèle Transformer comme all-MiniLM-L6-v2 : c'est un
 * surrogate lexical qui permet une recherche par similarité cosinus locale
 * sans réseau ni modèle lourd. Le stockage vectoriel embarqué
 * (embedded-vector-store.ts) réplique exactement cette fonction pour que
 * les deux couches JS partagent le même scoring déterministe.
 */
export class LocalEmbeddingFunction {
  private readonly dim = 384;

  async generate(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embed(t));
  }

  private embed(text: string): number[] {
    const vec = new Array<number>(this.dim).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vec;

    const counts = new Map<number, number>();
    for (const tok of tokens) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) {
        h = (h ^ tok.charCodeAt(i)) >>> 0;
        h = (h * 16777619) >>> 0;
      }
      const bucket = h % this.dim;
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }

    let norm = 0;
    for (const [bucket, count] of counts) {
      vec[bucket] = count;
      norm += count * count;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.dim; i++) vec[i] = vec[i] / norm;

    return vec;
  }
}

export function getLocalEmbedder() {
  return new LocalEmbeddingFunction();
}

let _chromaClient: any = null;
let chromaClientPromise: Promise<any> | null = null;

export async function getChromaClient(): Promise<any> {
  if (IS_CLOUD) return null;

  if (_chromaClient) return _chromaClient;

  if (!chromaClientPromise) {
    chromaClientPromise = (async () => {
      try {
        const { getEmbeddedChromaClient } = await import('./embedded-vector-store');
        _chromaClient = await getEmbeddedChromaClient();
        return _chromaClient;
      } catch (e) {
        console.warn('[CHROMA] Stockage vectoriel embarqué indisponible :', (e as Error).message);
        _chromaClient = null;
        chromaClientPromise = null;
        return null;
      }
    })();
  }

  return chromaClientPromise;
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
  if (!client) throw new Error("VECTOR_ENGINE_FAILED");
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

export async function getCollectionIds(collectionName: string): Promise<string[]> {
  if (IS_CLOUD) return [];
  try {
    const client = await getChromaClient();
    if (!client) return [];
    const col = await client.getOrCreateCollection({ name: collectionName });
    const res = await col.get({});
    return res.ids ?? [];
  } catch (e) {
    console.error('❌ [CHROMA_GET_IDS]', e);
    return [];
  }
}

export async function deleteDocuments(collectionName: string, ids: string[]): Promise<void> {
  if (IS_CLOUD || ids.length === 0) return;
  try {
    const client = await getChromaClient();
    if (!client) return;
    const col = await client.getOrCreateCollection({ name: collectionName });
    await col.delete({ ids });
    console.log(`🗑️ [CHROMA_DELETE] ${ids.length} document(s) supprimé(s) de '${collectionName}'`);
  } catch (e: any) {
    console.error(`❌ [CHROMA_DELETE_DOCS] ${e.message}`);
  }
}

export async function semanticSearch(options: SearchOptions, embeddingFunction?: any): Promise<SearchResult[]> {
  if (IS_CLOUD) return [];
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
}

export async function searchAcrossCollections(query: string, nResults = 5): Promise<SearchResult[]> {
  const mergedResults: SearchResult[] = [];
  const physical = fallbackSemanticSearch(query, nResults);
  mergedResults.push(...physical);

  if (!IS_CLOUD) {
    const collectionErrors: { collection: string; error: string }[] = [];
    try {
      const collections = await listCollections();
      for (const c of collections) {
        try {
          const results = await semanticSearch({ collectionName: c.name, query, nResults });
          results.forEach(r => {
            mergedResults.push({
              ...r,
              metadata: { ...r.metadata, origin: 'VEC_CHROMA' }
            });
          });
        } catch (e: any) {
          collectionErrors.push({ collection: c.name, error: e.message || String(e) });
        }
      }
    } catch (e: any) {
      console.error('[CHROMA_INDEX_SCAN]', e.message);
    }
    if (collectionErrors.length > 0) {
      console.warn('[CHROMA_INDEX_SCAN] Erreurs par collection:', collectionErrors);
    }
  }

  const unique = Array.from(new Map(mergedResults.map(r => [r.id, r])).values());
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
