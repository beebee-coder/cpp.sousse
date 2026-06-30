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
    
    // Décomposition en chunks sémantiques
    const chunks = [
      {
        id: `proc-meta-${procedure.id}`,
        content: `Procédure Industrielle: ${procedure.title} [CODE: ${procedure.code}]. Catégorie: ${procedure.metadata.category}. Département: ${procedure.metadata.department}. Criticité: ${procedure.metadata.criticality}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'metadata', 
          code: procedure.code,
          indexedAt: timestamp 
        }
      },
      ...procedure.steps.map((step, index) => ({
        id: `proc-step-${procedure.id}-${index}`,
        content: `Étape ${step.order} de ${procedure.code}: ${step.title}. Description: ${step.description}. Validation: ${step.validation.successExpression}.`,
        metadata: { 
          procedureId: procedure.id, 
          type: 'step', 
          order: step.order, 
          stepId: step.id,
          indexedAt: timestamp
        }
      }))
    ];

    try {
      if (IS_CLOUD) {
        // Indexation Weaviate Cloud via l'API interne pour les procédures
        const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
        await upsertKnowledgeItem({
          knowledgeId: procedure.id,
          userId: procedure.authorId || 'system',
          type: 'procedure',
          title: procedure.title,
          content: chunks.map(c => c.content).join('\n'),
          tags: procedure.metadata.tags || [],
          category: procedure.metadata.category,
          difficulty: procedure.metadata.criticality,
          isPublic: true,
          createdAt: procedure.metadata.createdAt
        });
        console.log(`📡 [RAG_CLOUD] Procédure ${procedure.code} vectorisée dans Weaviate.`);
      } else {
        // Indexation ChromaDB Local
        await upsertChroma('industrial_procedures', chunks);
        console.log(`🧠 [RAG_LOCAL] Procédure ${procedure.code} vectorisée dans ChromaDB.`);
      }
    } catch (e: any) {
      console.error(`❌ [RAG_ERROR] Échec de vectorisation obligatoire pour ${procedure.code}:`, e.message);
      throw new Error(`INDEXATION_FAILED: ${e.message}`);
    }
  }

  /**
   * Recherche d'assistance contextuelle.
   */
  async findHelp(query: string, procedureId?: string): Promise<SearchResult[]> {
    const results = await searchAcrossCollections(query, 5);
    if (procedureId) {
      return results.filter(r => r.metadata?.procedureId === procedureId || !r.metadata?.procedureId);
    }
    return results;
  }
}

export const procedureRAG = new ProcedureRAGService();
