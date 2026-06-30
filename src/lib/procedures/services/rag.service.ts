/**
 * @fileOverview Service RAG spécialisé pour les procédures industrielles.
 * Gère l'indexation sémantique et la recherche documentaire liée aux opérations.
 */

import { FullProcedure, ProcedureStep } from '../types';
import { upsertDocuments, searchAcrossCollections, SearchResult } from '@/lib/chroma';

export class ProcedureRAGService {
  /**
   * Indexe une procédure complète en la découpant en chunks (Étapes + Métadonnées).
   */
  async indexProcedure(procedure: FullProcedure): Promise<void> {
    const documents = [
      // Chunk 1: Métadonnées globales
      {
        id: `proc-meta-${procedure.id}`,
        content: `Procédure: ${procedure.title} [CODE: ${procedure.code}]. Catégorie: ${procedure.metadata.category}. Département: ${procedure.metadata.department}. Description: ${procedure.metadata.title}`,
        metadata: { procedureId: procedure.id, type: 'metadata', code: procedure.code }
      },
      // Chunks pour chaque étape
      ...procedure.steps.map((step, index) => ({
        id: `proc-step-${procedure.id}-${index}`,
        content: `Étape ${step.order}: ${step.title}. Action: ${step.action.instruction}. Description: ${step.description}`,
        metadata: { procedureId: procedure.id, type: 'step', order: step.order, stepId: step.id }
      }))
    ];

    try {
      await upsertDocuments('industrial_procedures', documents);
      console.log(`✅ [RAG] Procédure ${procedure.code} indexée.`);
    } catch (e) {
      console.error(`❌ [RAG] Échec indexation procédure:`, e);
    }
  }

  /**
   * Recherche des informations pertinentes pour aider l'opérateur.
   */
  async findHelp(query: string, procedureId?: string): Promise<SearchResult[]> {
    const results = await searchAcrossCollections(query, 5);
    if (procedureId) {
      // Filtrer ou prioriser les résultats de la procédure actuelle
      return results.filter(r => r.metadata?.procedureId === procedureId || !r.metadata?.procedureId);
    }
    return results;
  }
}

export const procedureRAG = new ProcedureRAGService();
