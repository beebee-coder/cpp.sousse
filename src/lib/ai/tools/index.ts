import { toolRegistry, type AppTool } from '../tool-registry';

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
    execute: async () => {
      return {
        success: true,
        data: { text: 'Procédures disponibles dans le registre. Utilisez le navigateur BDD pour explorer.' }
      };
    }
  };

  const bankTool: AppTool = {
    name: 'search_bank',
    description: 'Rechercher dans la banque d\'images et vidéos',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Requête de recherche' },
        type: { type: 'string', enum: ['image', 'video', 'all'] }
      },
      required: ['query']
    },
    execute: async (params) => {
      return {
        success: true,
        data: { text: `Recherche "${params.query}" dans la banque multimédia.` }
      };
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
      return {
        success: true,
        data: { text: `Recherche "${params.query}" dans la base de connaissances.` }
      };
    }
  };

  const visionTool: AppTool = {
    name: 'analyze_image',
    description: 'Analyser une image industrielle',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL de l\'image' },
        prompt: { type: 'string', description: 'Instruction d\'analyse' }
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
