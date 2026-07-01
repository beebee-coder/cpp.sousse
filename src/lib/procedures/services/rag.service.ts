
/**
 * @fileOverview Service RAG spécialisé pour les procédures industrielles.
 * Version : Automatique et Obligatoire (Support Hybride Weaviate/Chroma).
 */

import { FullProcedure } from '../types';
import { upsertDocuments as upsertChroma, searchAcrossCollections, SearchResult } from '@/lib/chroma';

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

export class ProcedureRAGService {
  /**
   * Indexe une procédure de manière obligatoire.
   * Gère le routage vers Weaviate (Cloud) ou Chroma (Local).
   */
  async indexProcedure(procedure: FullProcedure): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Décomposition en chunks sémantiques pour une recherche précise
    const chunks = [
      {
        id: `proc-meta-${procedure.id}`,
        content: `Procédure Industrielle: ${procedure.title} [CODE: ${procedure.code}]. Catégorie: ${procedure.metadata?.category || 'OP'}. Département: ${procedure.metadata?.department || 'PROD'}. Criticité: ${procedure.metadata?.criticality || 'MED'}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'metadata', 
          code: procedure.code,
          indexedAt: timestamp 
        }
      },
      ...((Array.isArray(procedure.steps) ? procedure.steps : []) as any[]).map((step: any, index: number) => ({
        id: `proc-step-${procedure.id}-${index}`,
        content: `Étape ${step.order || index + 1} de ${procedure.code}: ${step.title}. Description: ${step.description}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'step', 
          order: step.order || index + 1, 
          stepId: step.id,
          indexedAt: timestamp
        }
      }))
    ];

    try {
      if (IS_CLOUD) {
        // Vérifier si Weaviate est configuré avant de tenter l'importation
        if (!process.env.WEAVIATE_URL || !process.env.WEAVIATE_API_KEY) {
          console.warn(`[RAG_CLOUD] Skip: Configuration Weaviate manquante pour ${procedure.code}`);
          return;
        }

        // Indexation Weaviate Cloud via l'API interne pour les procédures
        const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
        await upsertKnowledgeItem({
          knowledgeId: procedure.id,
          userId: procedure.authorId || 'system',
          type: 'procedure',
          title: procedure.title,
          content: chunks.map(c => c.content).join('\n'),
          tags: (procedure.metadata as any)?.tags || [],
          category: procedure.category || 'OPERATION',
          difficulty: procedure.criticality || 'MEDIUM',
          isPublic: true,
          createdAt: new Date().toISOString()
        });
        console.log(`📡 [RAG_CLOUD] Procédure ${procedure.code} vectorisée dans Weaviate.`);
      } else {
        // Indexation ChromaDB Local
        await upsertChroma('industrial_procedures', chunks);
        console.log(`🧠 [RAG_LOCAL] Procédure ${procedure.code} vectorisée dans ChromaDB.`);
      }
    } catch (e: any) {
      console.error(`❌ [RAG_ERROR] Échec de vectorisation pour ${procedure.code}:`, e.message);
      // On ne jette plus l'erreur pour ne pas bloquer le flux principal
    }
  }

  /**
   * Recherche d'assistance contextuelle.
   */
  async findHelp(query: string, procedureId?: string): Promise<SearchResult[]> {
    try {
      const results = await searchAcrossCollections(query, 5);
      if (procedureId) {
        return results.filter(r => r.metadata?.procedureId === procedureId || !r.metadata?.procedureId);
      }
      return results;
    } catch (e) {
      return [];
    }
  }
}

export const procedureRAG = new ProcedureRAGService();
