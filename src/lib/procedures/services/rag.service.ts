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
   * Isole les erreurs pour ne pas bloquer le flux de forge principal.
   */
  async indexProcedure(procedure: FullProcedure): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Construction du bloc de connaissances sémantiques
    const chunks = [
      {
        id: `proc-meta-${procedure.id}`,
        content: `DOCUMENTATION TECHNIQUE: ${procedure.title} [CODE: ${procedure.code}]. Catégorie: ${procedure.category}. Département: ${procedure.department}. Criticité: ${procedure.criticality}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'metadata', 
          code: procedure.code,
          indexedAt: timestamp 
        }
      },
      ...((Array.isArray(procedure.steps) ? procedure.steps : []) as any[]).map((step: any, index: number) => ({
        id: `proc-step-${procedure.id}-${index}`,
        content: `INSTRUCTION ÉTAPE ${step.order || index + 1} (${procedure.code}): ${step.title}. Action requise: ${step.description}.`,
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
        // Mode Web : Tentative Weaviate (Cloud)
        if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
          try {
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
              createdAt: timestamp
            });
          } catch (e) {
             console.warn("[RAG_WEAVIATE_SKIP] Serveur non configuré.");
          }
        }
      } else {
        // Mode Natif : Indexation ChromaDB Local (obligatoire pour le mode desktop)
        await upsertChroma('industrial_procedures', chunks);
      }
    } catch (e: any) {
      console.warn(`[RAG_INDEX_WARN] Vectorisation ignorée pour ${procedure.code}: ${e.message}`);
    }
  }

  /**
   * Recherche d'assistance contextuelle pour l'IA.
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