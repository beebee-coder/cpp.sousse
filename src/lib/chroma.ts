// Types ChromaDB — Le bon nom est 'EmbeddingFunction' (pas 'IEmbeddingFunction')
import { ChromaClient, Collection } from 'chromadb';
import type { EmbeddingFunction } from 'chromadb';

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
  metadata: Record<string, string | number | boolean> | null;
  distance: number;
  score: number;
}

// ─── Embedding Local (HuggingFace Transformers.js) ───────────────────────────
// Modèle : Xenova/all-MiniLM-L6-v2 (384 dimensions)
// ✅ Gratuit, aucune API key, tourne en local via ONNX Runtime

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipeline(): Promise<any> {
  if (_pipeline) return _pipeline;
  // Import dynamique pour éviter les problèmes SSR avec Next.js
  const mod = await import('@huggingface/transformers');
  const { pipeline, env } = mod;
  // Répertoire de cache local
  env.cacheDir = './.cache/huggingface';
  // Charge le modèle (téléchargé une seule fois ~25 MB, mis en cache)
  _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return _pipeline;
}

/**
 * Fonction d'embedding locale — implémente EmbeddingFunction de ChromaDB.
 * Vectorise les textes avec all-MiniLM-L6-v2 (ONNX Runtime).
 */
export class LocalEmbeddingFunction implements EmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    const extractor = await getPipeline();
    // pooling 'mean' + normalisation L2 → vecteurs comparables par distance cosine
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return output.tolist() as number[][];
  }
}

let _localEmbedder: LocalEmbeddingFunction | null = null;

export function getLocalEmbedder(): LocalEmbeddingFunction {
  if (!_localEmbedder) _localEmbedder = new LocalEmbeddingFunction();
  return _localEmbedder;
}

// ─── Client ChromaDB Singleton ───────────────────────────────────────────────

let _chromaClient: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (!_chromaClient) {
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
  return getChromaClient().getOrCreateCollection({ name, embeddingFunction });
}

export async function deleteCollection(name: string): Promise<void> {
  await getChromaClient().deleteCollection({ name });
}

export async function listCollections(): Promise<{ name: string }[]> {
  return getChromaClient().listCollections();
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

export async function deleteDocuments(collectionName: string, ids: string[]): Promise<void> {
  const col = await getOrCreateCollection(collectionName);
  await col.delete({ ids });
}

// ─── Recherche Sémantique ────────────────────────────────────────────────────

export async function semanticSearch(
  options: SearchOptions,
  embeddingFunction: EmbeddingFunction = getLocalEmbedder()
): Promise<SearchResult[]> {
  const { collectionName, query, nResults = 5, whereFilter } = options;
  const col = await getOrCreateCollection(collectionName, embeddingFunction);

  const queryParams: Parameters<Collection['query']>[0] = {
    queryTexts: [query],
    nResults,
  };

  if (whereFilter && Object.keys(whereFilter).length > 0) {
    queryParams.where = whereFilter as Parameters<Collection['query']>[0]['where'];
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
      metadata: (metas[i] as Record<string, string | number | boolean>) ?? null,
      distance: dist,
      score: parseFloat((1 - dist).toFixed(4)),
    };
  });
}

export async function getDocumentById(
  collectionName: string,
  id: string
): Promise<SearchResult | null> {
  const col = await getOrCreateCollection(collectionName);
  const result = await col.get({ ids: [id] });
  if (!result.ids.length) return null;
  return {
    id: result.ids[0],
    document: result.documents[0] ?? '',
    metadata: (result.metadatas?.[0] as Record<string, string | number | boolean>) ?? null,
    distance: 0,
    score: 1,
  };
}

// ─── RAG INDUSTRIAL DOCUMENTS & SEEDING ──────────────────────────────────────

export const RAG_SAMPLE_DOCUMENTS: DocumentToAdd[] = [
  {
    id: 'manual-panel-valves',
    content: "Manuel technique d'entretien pour le Panneau de Contrôle. Il décrit la procédure de vérification périodique des vannes d'admission de fluide, le calibrage des manomètres de pression analogiques, et les inspections d'étanchéité des raccords filetés. En cas de surpression critique, fermer immédiatement la vanne d'isolement principale.",
    metadata: { component: 'industrial-control', title: "Guide de Maintenance des Vannes et Manomètres", url: "/docs/maintenance_vannes.pdf" }
  },
  {
    id: 'manual-panel-safety',
    content: "Protocole de sécurité opérationnelle pour le Panneau de Commande Électrique. Contient les étapes obligatoires pour l'activation, le test mensuel et le réarmement du bouton d'arrêt d'urgence rouge (mushroom switch). Détaille l'analyse de la pression résiduelle avant toute intervention.",
    metadata: { component: 'industrial-control', title: "Protocole d'Arrêt d'Urgence et Sécurité", url: "/docs/securite_arret_urgence.pdf" }
  },
  {
    id: 'manual-pump-troubleshoot',
    content: "Guide complet de dépannage pour la Pompe Centrifuge HydroFlow. Explique les procédures d'alignement d'arbre moteur, de lubrification des paliers lisses, et le remplacement de la garniture mécanique d'étanchéité. Si des vibrations ou bruits anormaux de cavitation surviennent, vérifier le serrage des ancrages au socle.",
    metadata: { component: 'pump-system', title: "Guide de Dépannage Pompe Centrifuge HydroFlow", url: "/docs/depannage_pompe.pdf" }
  },
  {
    id: 'manual-pump-motor',
    content: "Fiche technique de spécification du moteur électrique de pompe. Caractéristiques nominales du moteur asynchrone triphasé accouplé à la pompe centrifuge : Tension 400V, Intensité 12A, Vitesse 2900 tr/min, classe d'isolation F. Détaille le plan de graissage recommandé.",
    metadata: { component: 'pump-system', title: "Fiche Spécification Moteur Électrique", url: "/docs/moteur_electrique.pdf" }
  },
  {
    id: 'manual-robot-ops',
    content: "Manuel d'utilisation et de programmation du Bras Robotisé Industriel RoboArm v4. Contient la calibration des coordonnées cartésiennes des axes de rotation XYZ, le calibrage de l'outil de préhension pneumatique (gripper), et la configuration des barrières immatérielles laser de sécurité.",
    metadata: { component: 'factory-floor', title: "Manuel d'Opération RoboArm v4", url: "/docs/roboarm_operation.pdf" }
  },
  {
    id: 'manual-conveyor-main',
    content: "Guide de maintenance préventive pour les convoyeurs à bande de la ligne d'assemblage automatisée. Explique la tension adéquate de la bande, le réglage des galets de guidage, la lubrification de la chaîne de transmission, et la vitesse limite de 1.5 m/s.",
    metadata: { component: 'factory-floor', title: "Maintenance des Convoyeurs Industriels", url: "/docs/maintenance_convoyeur.pdf" }
  }
];

/**
 * Seed les manuels techniques industriels dans la collection ChromaDB locale.
 */
export async function seedIndustrialManuals(): Promise<void> {
  const collectionName = 'industrial_manuals';
  try {
    const collections = await listCollections();
    const exists = collections.some(c => c.name === collectionName);
    
    if (!exists) {
      console.log(`🌱 Collection RAG "${collectionName}" non détectée. Initialisation et seeding...`);
      await addDocuments(collectionName, RAG_SAMPLE_DOCUMENTS);
      console.log(`🌱 Seeding de ${RAG_SAMPLE_DOCUMENTS.length} manuels techniques dans ChromaDB terminé.`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Seeding ChromaDB non possible (ChromaDB hors-ligne ou non disponible). Fallback en mémoire actif.`, error.message);
  }
}

/**
 * Recherche sémantique de repli (locale / hors-ligne) si le serveur ChromaDB n'est pas joignable.
 */
export function fallbackSemanticSearch(
  query: string,
  nResults: number = 3,
  componentFilter?: string
): SearchResult[] {
  const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  
  const scored = RAG_SAMPLE_DOCUMENTS.map(doc => {
    if (componentFilter && doc.metadata?.component !== componentFilter) {
      return { doc, score: 0 };
    }
    
    let score = 0;
    const content = doc.content.toLowerCase();
    const title = (doc.metadata?.title as string || '').toLowerCase();
    
    queryTokens.forEach(token => {
      if (title.includes(token)) score += 3;
      if (content.includes(token)) score += 1;
    });
    
    if (query.toLowerCase().includes(String(doc.metadata?.component || '').toLowerCase())) {
      score += 5;
    }
    
    return { doc, score };
  });
  
  const filtered = scored
    .filter(item => item.score > 0 || queryTokens.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, nResults);
    
  return filtered.map(item => ({
    id: item.doc.id,
    document: item.doc.content,
    metadata: item.doc.metadata || null,
    distance: item.score > 0 ? parseFloat((1 / (1 + item.score)).toFixed(4)) : 1.0,
    score: item.score > 0 ? parseFloat((item.score / (10 + item.score)).toFixed(4)) : 0.0
  }));
}

/**
 * Récupère toutes les collections disponibles dans ChromaDB.
 * Utilisé pour la recherche multi-collection par le RAG.
 */
export async function getUserCollectionNames(): Promise<string[]> {
  try {
    const cols = await listCollections();
    return cols.map((c: any) => c.name);
  } catch {
    return ['industrial_manuals'];
  }
}

/**
 * Recherche sémantique multi-collection — cherche dans TOUTES les collections ChromaDB disponibles.
 * Permet au chat RAG d'exploiter les datasets ingérés par l'utilisateur.
 */
export async function searchAcrossCollections(
  query: string,
  nResultsPerCollection: number = 3
): Promise<SearchResult[]> {
  let allResults: SearchResult[] = [];

  try {
    const collectionNames = await getUserCollectionNames();
    console.log(`🔍 [CHROMA] Recherche multi-collection dans : ${collectionNames.join(', ')}`);

    const searchPromises = collectionNames.map(name =>
      semanticSearch({ collectionName: name, query, nResults: nResultsPerCollection })
        .then(results => results.map(r => ({ ...r, metadata: { ...r.metadata, _collection: name } })))
        .catch(() => [] as SearchResult[])
    );

    const resultsPerCollection = await Promise.all(searchPromises);
    allResults = resultsPerCollection.flat();

    // Trier par score décroissant et dédupliquer
    allResults.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    allResults = allResults.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    console.log(`📊 [CHROMA] Multi-collection : ${allResults.length} résultats totaux dans ${collectionNames.length} collection(s)`);
  } catch (error: any) {
    console.warn('⚠️ [CHROMA] searchAcrossCollections échoué, fallback en mémoire.', error.message);
    allResults = fallbackSemanticSearch(query, nResultsPerCollection);
  }

  return allResults.slice(0, nResultsPerCollection * 2);
}

/**
 * Charge les datasets JSONL utilisateur depuis le disque (data/chromadb/datasets/)
 * pour enrichir le fallback en mémoire lorsque ChromaDB est hors-ligne.
 */
export async function loadUserDatasetsFromDisk(): Promise<DocumentToAdd[]> {
  // Exécuté uniquement côté serveur (Node.js)
  if (typeof window !== 'undefined') return [];
  
  try {
    const { existsSync, readdirSync, readFileSync } = await import('fs');
    const { join } = await import('path');
    const datasetsDir = join(process.cwd(), 'data', 'chromadb', 'datasets');
    
    if (!existsSync(datasetsDir)) return [];

    const files = readdirSync(datasetsDir).filter(f => f.endsWith('.jsonl'));
    const docs: DocumentToAdd[] = [];

    for (const file of files) {
      const content = readFileSync(join(datasetsDir, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      lines.forEach((line, idx) => {
        try {
          const entry = JSON.parse(line);
          if (entry.question && entry.answer) {
            docs.push({
              id: `user-dataset-${file.replace('.jsonl', '')}-${idx}`,
              content: `Question: ${entry.question}\nRéponse: ${entry.answer}`,
              metadata: {
                source: file,
                title: `Dataset utilisateur : ${file.replace('.jsonl', '')}`,
                component: entry.category || 'user-dataset',
                url: `/data/chromadb/datasets/${file}`,
                ...entry
              }
            });
          }
        } catch { /* ligne malformée, ignorée */ }
      });
    }

    console.log(`📂 [CHROMA_DISK] ${docs.length} entrées chargées depuis ${files.length} dataset(s) utilisateur`);
    return docs;
  } catch (error: any) {
    console.warn('⚠️ [CHROMA_DISK] Impossible de charger les datasets disque :', error.message);
    return [];
  }
}

export default getChromaClient;

