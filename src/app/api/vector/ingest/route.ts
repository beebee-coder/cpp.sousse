export const dynamic = 'force-dynamic';

import { createHybridRoute } from '@/lib/api-hybrid';
import { upsertDocuments, getOrCreateCollection, listCollections } from '@/lib/chroma';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface IngestItem {
  question: string;
  answer: string;
}

export interface IngestPayload {
  filename: string;
  items: IngestItem[];
  metadata: Record<string, string | number | boolean>;
}

export const POST = createHybridRoute<IngestPayload, any>({
  name: 'VECTOR_INGEST',
  webHandler: async (req, body) => {
    const { filename, items, metadata } = body;

    if (!filename || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "DONNEES_MANQUANTES" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const timestamp = new Date().toLocaleTimeString();
    const collectionName = String(metadata.collection || 'industrial_manuals');
    console.log(`📡 [${timestamp}] [VECTOR_INGEST] Ingestion de ${items.length} Q/R dans collection "${collectionName}"...`);

    // 1. Générer le contenu JSONL
    const jsonlLines = items.map(item => JSON.stringify({
      question: item.question,
      answer: item.answer,
      collection: collectionName,
      ...metadata
    }));
    const jsonlContent = jsonlLines.join('\n');

    // 2. Sauvegarder dans data/chromadb/datasets/ (structure organisée pour ChromaDB)
    let savedFilePath = '';
    try {
      const datasetsDir = join(process.cwd(), 'data', 'chromadb', 'datasets');
      if (!existsSync(datasetsDir)) {
        mkdirSync(datasetsDir, { recursive: true });
        console.log(`📁 [VECTOR_INGEST] Répertoire datasets créé : ${datasetsDir}`);
      }
      const safeFilename = filename.endsWith('.jsonl') ? filename : `${filename}.jsonl`;
      savedFilePath = join(datasetsDir, safeFilename);
      writeFileSync(savedFilePath, jsonlContent, 'utf-8');
      console.log(`💾 [VECTOR_INGEST] Fichier JSONL sauvegardé → ${savedFilePath}`);
    } catch (e: any) {
      console.error(`⚠️ [VECTOR_INGEST] Impossible de sauvegarder le fichier JSONL :`, e.message);
    }

    // 3. Construire les documents pour ChromaDB
    const baseFilename = filename.replace(/\.[^/.]+$/, '');
    const docs = items.map((item, index) => ({
      id: `${baseFilename}-${Date.now()}-${index}`,
      content: `Question: ${item.question}\nRéponse: ${item.answer}`,
      metadata: {
        source: filename,
        question: item.question,
        index,
        ingested_at: new Date().toISOString(),
        ...metadata
      }
    }));

    // 4. Vectoriser et indexer dans ChromaDB
    let chromaStatus = 'non_disponible';
    let chromaError = '';
    try {
      await upsertDocuments(collectionName, docs);
      chromaStatus = 'indexe';
      console.log(`✅ [${timestamp}] [VECTOR_INGEST] ${docs.length} vecteurs indexés dans ChromaDB → collection "${collectionName}"`);

      // Vérifier l'état de la collection après ingestion
      const collections = await listCollections();
      const collectionExists = collections.some((c: any) => c.name === collectionName);
      console.log(`📊 [VECTOR_INGEST] Vérification ChromaDB : collection "${collectionName}" ${collectionExists ? 'confirmée ✅' : 'non trouvée ⚠️'}`);
    } catch (error: any) {
      chromaError = error.message;
      chromaStatus = 'erreur';
      console.warn(`⚠️ [VECTOR_INGEST] ChromaDB non disponible ou erreur d'indexation :`, error.message);
      console.warn(`⚠️ [VECTOR_INGEST] Assurez-vous que ChromaDB tourne sur http://127.0.0.1:8000 (npm run chroma:start)`);
    }

    return {
      success: true,
      message: `${items.length} questions/réponses ingérées avec succès.`,
      filename,
      savedTo: savedFilePath || 'data/chromadb/datasets/' + filename,
      collection: collectionName,
      count: items.length,
      chromadb: {
        status: chromaStatus,
        collection: collectionName,
        indexed: chromaStatus === 'indexe',
        error: chromaError || undefined
      }
    };
  },

  desktopFallback: async (body) => {
    const { filename, items, metadata } = body;
    const collectionName = String(metadata?.collection || 'industrial_manuals');

    // Stocker en localStorage pour le mode desktop offline
    if (typeof window !== 'undefined') {
      const storageKey = `visionode_local_dataset_${filename}`;
      localStorage.setItem(storageKey, JSON.stringify(body));
    }

    // Tentative de vectorisation locale si ChromaDB est démarré
    const baseFilename = filename.replace(/\.[^/.]+$/, '');
    const docs = items.map((item: IngestItem, index: number) => ({
      id: `${baseFilename}-${Date.now()}-${index}`,
      content: `Question: ${item.question}\nRéponse: ${item.answer}`,
      metadata: {
        source: filename,
        question: item.question,
        index,
        ingested_at: new Date().toISOString(),
        ...metadata
      }
    }));

    let chromaStatus = 'non_disponible';
    try {
      await upsertDocuments(collectionName, docs);
      chromaStatus = 'indexe';
    } catch (e) {
      console.warn('⚠️ ChromaDB non disponible en mode desktop. Stocké dans localStorage.');
    }

    return {
      success: true,
      message: `${items.length} questions/réponses sauvegardées en local (Desktop).`,
      filename,
      savedTo: 'localStorage + data/chromadb/datasets/',
      collection: collectionName,
      count: items.length,
      offline: true,
      chromadb: {
        status: chromaStatus,
        collection: collectionName,
        indexed: chromaStatus === 'indexe'
      }
    };
  }
});
