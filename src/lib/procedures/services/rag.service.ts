/**
 * @fileOverview Service RAG spécialisé pour les procédures industrielles [RAG_VECTOR].
 * Version : Automatique et Obligatoire (Support Hybride Weaviate/Chroma).
 */

import { FullProcedure, ProcedureStep } from '../types';
import { upsertDocuments as upsertChroma, searchAcrossCollections, SearchResult } from '@/lib/chroma';

const IS_CLOUD = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

export class ProcedureRAGService {
  /**
   * Indexe une procédure de manière obligatoire [RAG_INDEX].
   */
  async indexProcedure(procedure: FullProcedure): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`🧠 [RAG_INDEX] [INIT] Préparation du découpage sémantique pour : ${procedure.code}`);
    
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

    console.log(`🧠 [RAG_INDEX] [STEP] ${chunks.length} chunks générés pour vectorisation.`);

    try {
      if (IS_CLOUD) {
        console.log(`📡 [RAG_VECTOR] [CLOUD] Tentative d'indexation Weaviate Cloud...`);
        if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
          try {
            const { upsertKnowledgeItem } = await import('@/lib/weaviate/weaviate-knowledge');
            await upsertKnowledgeItem({
              knowledgeId: procedure.id,
              userId: procedure.authorId || 'system',
              type: 'procedure',
              title: procedure.title,
              content: chunks.map(c => c.content).join('\n'),
              tags: ((procedure.metadata as any)?.tags) || [],
              category: (procedure.category as string) || 'OPERATION',
              difficulty: (procedure.criticality as string) || 'MEDIUM',
              isPublic: true,
              createdAt: timestamp
            });
            console.log(`✅ [RAG_VECTOR] [CLOUD_SUCCESS] Procédure vectorisée dans Weaviate.`);
          } catch (e: any) {
             console.warn("⚠️ [RAG_VECTOR] [CLOUD_ERROR] Échec Weaviate :", e.message);
          }
        }
      } else {
        console.log(`🧠 [RAG_VECTOR] [LOCAL] Tentative d'indexation ChromaDB local...`);
        await upsertChroma('industrial_procedures', chunks);
        console.log(`✅ [RAG_VECTOR] [LOCAL_SUCCESS] Procédure vectorisée dans ChromaDB.`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [RAG_VECTOR] [ERROR] Erreur non-fatale lors de l'indexation: ${e.message}`);
    }
  }

  async findHelp(query: string, procedureId?: string): Promise<SearchResult[]> {
    console.log(`🔍 [RAG_VECTOR] [SEARCH] Recherche sémantique d'aide pour : "${query.slice(0, 30)}..."`);
    try {
      const results = await searchAcrossCollections(query, 5);
      if (procedureId) {
        const filtered = results.filter(r => r.metadata?.procedureId === procedureId || !r.metadata?.procedureId);
        console.log(`✅ [RAG_VECTOR] [SEARCH_SUCCESS] ${filtered.length} résultats pertinents trouvés.`);
        return filtered;
      }
      return results;
    } catch (e) {
      console.error(`❌ [RAG_VECTOR] [SEARCH_ERROR] Échec recherche aide.`);
      return [];
    }
  }
}

export const procedureRAG = new ProcedureRAGService();
