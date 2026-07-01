/**
 * @fileOverview Service RAG spécialisé pour les procédures industrielles.
 * Version : Automatique et Obligatoire (Support Hybride Weaviate/Chroma).
 */

import { FullProcedure, ProcedureStep } from '../types';
import { upsertDocuments as upsertChroma, searchAcrossCollections, SearchResult } from '@/lib/chroma';

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

export class ProcedureRAGService {
  /**
   * Indexe une procédure de manière obligatoire.
   */
  async indexProcedure(procedure: FullProcedure): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`🧠 [RAG_SERVICE] Préparation indexation pour: ${procedure.code}`);
    
    // Casting sécurisé des étapes Prisma (Json) vers notre interface
    const steps = (procedure.steps as unknown as ProcedureStep[]) || [];

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
      ...steps.map((step, index) => ({
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
            console.log(`✅ [RAG_SERVICE] Vectorisé dans Weaviate Cloud.`);
          } catch (e: any) {
             console.warn("[RAG_SERVICE] Échec Weaviate:", e.message);
          }
        }
      } else {
        await upsertChroma('industrial_procedures', chunks);
        console.log(`✅ [RAG_SERVICE] Vectorisé dans ChromaDB.`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [RAG_SERVICE] Erreur RAG: ${e.message}`);
    }
  }

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
