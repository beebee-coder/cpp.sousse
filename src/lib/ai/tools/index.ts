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

  const readProcedureTool: AppTool = {
    name: 'read_procedure',
    description: "Lire une procédure industrielle stockée dans le Registre physique (.registry/procedures/{code}/procedure.json). Renvoie le guidage pas-à-pas (prérequis, étapes, alarmes, remèdes). Utilise si l'utilisateur demande 'lis la procédure X', 'affiche les étapes de ...', 'que faire pour la procédure CRF-START-001'.",
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: "Code de la procédure, ex: CRF-START-001 (insensible à la casse/format)" },
        title: { type: 'string', description: "Titre ou partie du titre si le code est inconnu" }
      }
    },
    execute: async (params) => {
      try {
        const code = (params.code as string || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const titleQuery = (params.title as string || '').toLowerCase();

        // 1. Mode local/hybride : lecture directe du Registre physique.
        const REGISTRY_OVERRIDE = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
        const REGISTRY_ROOT = REGISTRY_OVERRIDE
          ? REGISTRY_OVERRIDE
          : require('path').join(process.cwd(), '.registry');
        const PROC_DIR = require('path').join(REGISTRY_ROOT, 'procedures');

        const candidates: string[] = [];
        if (require('fs').existsSync(PROC_DIR)) {
          for (const entry of require('fs').readdirSync(PROC_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const procPath = require('path').join(PROC_DIR, entry.name, 'procedure.json');
            if (require('fs').existsSync(procPath)) candidates.push(procPath);
          }
        }

        let chosen: any = null;
        for (const p of candidates) {
          let parsed: any = null;
          try { parsed = JSON.parse(require('fs').readFileSync(p, 'utf8')); } catch { continue; }
          const meta = parsed?.metadata || {};
          const metaCode = (meta.code || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const metaTitle = (meta.title || '').toString().toLowerCase();
          if (code && (metaCode.includes(code) || p.toLowerCase().includes(code))) { chosen = parsed; break; }
          if (titleQuery && metaTitle.includes(titleQuery)) { chosen = parsed; break; }
        }

        // 2. Fallback cloud (web) : recherche dans knowledgeItem par tag regpath.
        if (!chosen) {
          try {
            const { getPrismaClient } = await import('@/lib/db/prisma-client');
            const prisma = await getPrismaClient();
            const items = await prisma.knowledgeItem.findMany({
              where: { tags: { has: 'regpath:procedures' }, type: 'procedure' },
              take: 50,
            });
            for (const it of items) {
              let parsed: any = null;
              try { parsed = typeof it.content === 'string' ? JSON.parse(it.content) : it.content; } catch { continue; }
              const meta = parsed?.metadata || {};
              const metaCode = (meta.code || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              const metaTitle = (meta.title || '').toString().toLowerCase();
              if (code && (metaCode.includes(code))) { chosen = parsed; break; }
              if (titleQuery && metaTitle.includes(titleQuery)) { chosen = parsed; break; }
            }
          } catch { /* cloud indisponible */ }
        }

        if (!chosen) {
          return { success: false, error: `Procédure introuvable${code ? ` pour le code "${params.code}"` : ''}.` };
        }

        const meta = chosen.metadata || {};
        const steps = Array.isArray(chosen.steps) ? chosen.steps : [];
        const prereq = chosen.prerequisites?.items || [];
        const alarms = steps.flatMap((s: any) => Array.isArray(s.alarms) ? s.alarms : []);

        const lines: string[] = [];
        lines.push(`# ${meta.code || ''} — ${meta.title || 'Procédure'}`);
        lines.push(`Catégorie: ${meta.category || 'N/A'} | Criticité: ${meta.criticality || 'N/A'} | Version: ${meta.version || 'N/A'}`);
        if (prereq.length) {
          lines.push('\n## Prérequis');
          for (const pr of prereq) lines.push(`- ${pr.displayName || pr.id} : ${pr.description || ''} (${pr.manualCheckInstruction || 'vérification manuelle'})`);
        }
        if (steps.length) {
          lines.push('\n## Étapes (guidage pas-à-pas)');
          steps.forEach((s: any, i: number) => {
            lines.push(`\n${i + 1}. ${s.title || ''} — ${s.subtitle || ''}`);
            if (s.description) lines.push(`   ${s.description}`);
            if (s.action?.instruction) lines.push(`   Action: ${s.action.instruction}`);
            const stepAlarms = Array.isArray(s.alarms) ? s.alarms : [];
            for (const a of stepAlarms) {
              lines.push(`   ⚠️ Alarme ${a.code || ''} (${a.severity || ''}): ${a.description || ''}`);
              if (a.remedy?.steps?.length) lines.push(`      Remède: ${a.remedy.steps.join(' → ')}`);
            }
          });
        }
        if (alarms.length) {
          lines.push('\n## Alarmes & remèdes');
          for (const a of alarms) {
            lines.push(`- ${a.code || ''} (${a.severity || ''}): ${a.description || ''} → ${a.remedy?.title || ''}`);
          }
        }

        return {
          success: true,
          data: { text: lines.join('\n') || 'Procédure vide.' },
          procedureId: meta.code,
          // Lien direct vers le Guide IA (Procedure Guide) — exploité par le
          // chat pour lancer le guidage pas-à-pas depuis la conversation.
          guideUrl: `/procedures/guide/${encodeURIComponent(meta.code)}`,
          executeUrl: `/procedures/${encodeURIComponent(meta.code)}/execute`,
        };
      } catch (e: any) {
        return { success: false, error: `Erreur lecture procédure: ${e.message}` };
      }
    }
  };

  toolRegistry.register(procedureTool);
  toolRegistry.register(bankTool);
  toolRegistry.register(knowledgeTool);
  toolRegistry.register(visionTool);
  toolRegistry.register(readProcedureTool);
}
