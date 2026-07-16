import { toolRegistry, type AppTool } from '../tool-registry';
import { procedureManager } from '@/lib/procedures/services/procedure-manager.service';
import { searchAcrossCollections, fallbackSemanticSearch } from '@/lib/chroma';

export function registerAppTools() {
  if (toolRegistry.getAll().length > 0) return;

  const procedureTool: AppTool = {
    name: 'list_procedures',
    description: 'Lister les procédures industrielles disponibles',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filtrer par catégorie' },
        limit: { type: 'number', description: 'Nombre max de résultats' }
      }
    },
    execute: async (params) => {
      try {
        const filters: any = {};
        if (params.category) filters.category = params.category;
        const procedures = await procedureManager.list(filters);
        const limit = params.limit ? Number(params.limit) : 10;
        const sliced = (procedures as any[]).slice(0, limit);
        const text = sliced.map((p: any) => `[${p.code}] ${p.title} — ${p.category} (${p.status})`).join('\n');
        return { success: true, data: { text: text || 'Aucune procédure trouvée.' } };
      } catch (e: any) {
        return { success: false, error: `Erreur listage procédures: ${e.message}` };
      }
    }
  };

  const bankTool: AppTool = {
    name: 'search_bank',
    description: "Rechercher dans la banque d'images et vidéos",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Requête de recherche' },
        type: { type: 'string', enum: ['image', 'video', 'all'] }
      },
      required: ['query']
    },
    execute: async (params) => {
      try {
        const query = params.query as string;
        const typeParam = params.type === 'image' || params.type === 'video' ? params.type : undefined;

        // Mode cloud (Weaviate configuré) : recherche vectorielle sémantique.
        if (process.env.WEAVIATE_URL && process.env.WEAVIATE_API_KEY) {
          const { searchBankAssets } = await import('@/lib/weaviate/weaviate-bank');
          const hits = await searchBankAssets(query, { type: typeParam, nResults: 5 });
          const text = hits
            .map(h => `[${h.type || 'asset'}] ${h.name} — ${h.description || ''} ${(h.tags || []).join(', ')}`.trim())
            .join('\n');
          return { success: true, data: { text: text || 'Aucun média trouvé dans la banque.' } };
        }

        // Station locale / hybride : recherche lexicale sur les métadonnées.
        const results = fallbackSemanticSearch(query, 5);
        let bankResults = results.filter(r => r.metadata?.origin === 'PHY_BANK');
        if (typeParam) {
          bankResults = bankResults.filter(r => r.metadata?.type === typeParam);
        }
        const text = bankResults
          .map(r => `[${r.metadata?.type || 'asset'}] ${r.metadata?.name || r.document.slice(0, 60)}`)
          .join('\n');
        return { success: true, data: { text: text || 'Aucun média trouvé dans la banque.' } };
      } catch (e: any) {
        return { success: false, error: `Erreur recherche banque: ${e.message}` };
      }
    }
  };

  const knowledgeTool: AppTool = {
    name: 'search_knowledge',
    description: 'Rechercher dans la base de connaissances',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Requête de recherche' },
        category: { type: 'string', description: 'Catégorie' }
      },
      required: ['query']
    },
    execute: async (params) => {
      try {
        const results = await searchAcrossCollections(params.query, 5);
        const text = results.map(r => `[${r.metadata?.type || 'doc'}] ${r.metadata?.title || r.document.slice(0, 80)}`).join('\n');
        return { success: true, data: { text: text || 'Aucune connaissance trouvée.' } };
      } catch (e: any) {
        return { success: false, error: `Erreur recherche connaissances: ${e.message}` };
      }
    }
  };

  const visionTool: AppTool = {
    name: 'analyze_image',
    description: 'Analyser une image industrielle',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: "URL de l'image" },
        prompt: { type: 'string', description: "Instruction d'analyse" }
      },
      required: ['imageUrl']
    },
    execute: async (params) => {
      return {
        success: true,
        data: { text: `Analyse visuelle demandée pour: ${params.imageUrl}` },
        media: [{ type: 'image', url: params.imageUrl }]
      };
    }
  };

  toolRegistry.register(procedureTool);
  toolRegistry.register(bankTool);
  toolRegistry.register(knowledgeTool);
  toolRegistry.register(visionTool);
}
