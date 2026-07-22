import fs from 'fs';
import path from 'path';
import { getLocalDBRoot } from './local-db';

/**
 * @fileOverview Liaison physique pour le Registre local [REGISTRY_FS].
 * Version : Scan récursif pour synchronisation réelle de l'Explorateur BDD.
 */

const REGISTRY_ROOT = (() => {
  const localRoot = getLocalDBRoot();
  const candidate = path.join(path.dirname(localRoot), '.registry');
  if (fs.existsSync(candidate)) return candidate;
  const override = process.env.REGISTRY_ROOT_OVERRIDE?.trim();
  if (override) return override;
  return path.join(process.cwd(), '.registry');
})();

const ensureRegistry = () => {
  // Résilient au FS read-only (ex: Vercel serverless) : on ignore l'échec de création.
  try {
    if (!fs.existsSync(REGISTRY_ROOT)) {
      fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
    }
    const dirs = ['items', 'bank', 'procedures', 'Alarmes'];
    dirs.forEach(dir => {
      const target = path.join(REGISTRY_ROOT, dir);
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    });

    const rhBase = path.join(REGISTRY_ROOT, 'ressources humaines', 'equipes');
    ['equipe A', 'equipe B', 'equipe C', 'equipe D'].forEach(equipe => {
      const target = path.join(rhBase, equipe);
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    });
  } catch (e) {
    console.warn('[REGISTRY_FS] FS read-only, création de .registry ignorée:', (e as Error).message);
  }
};

interface FSNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FSNode[];
}

export const postgresClient = {
  /**
   * Scan récursif du registre physique pour l'arborescence UI.
   */
  async getRegistryTree(): Promise<FSNode[]> {
    ensureRegistry();
    const ts = new Date().toLocaleTimeString();
    console.log(`🔍 [REGISTRY_FS] [SCAN] [${ts}] Début du scan de l'arborescence physique.`);

    const scan = (dir: string, base: string = ''): FSNode[] => {
      if (!fs.existsSync(dir)) return [];
      const items = fs.readdirSync(dir, { withFileTypes: true });
      return items.map(item => {
        const relPath = path.join(base, item.name).replace(/\\/g, '/');
        const absPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          return {
            id: relPath,
            name: item.name,
            type: 'folder',
            children: scan(absPath, relPath)
          };
        }
        return {
          id: relPath,
          name: item.name,
          type: 'file'
        };
      });
    };

    try {
      return scan(REGISTRY_ROOT);
    } catch (e: any) {
      console.error(`❌ [REGISTRY_FS] [SCAN_ERROR] :`, e.message);
      return [];
    }
  },

  async getFile(relPath: string) {
    const ts = new Date().toLocaleTimeString();
    console.log(`📖 [REGISTRY_FS] [READ] [${ts}] Lecture : ${relPath}`);
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) throw new Error("FICHIER_INTROUVABLE");
    
    // [Point 5] MIME dérivé de l'extension réelle (pas d'écrasement webm -> image/jpeg).
    const EXT_MIME: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };

    const ext = path.extname(fullPath).toLowerCase();
    if (EXT_MIME[ext]) {
      const buffer = fs.readFileSync(fullPath);
      return `data:${EXT_MIME[ext]};base64,${buffer.toString('base64')}`;
    }

    // R7 — Tout fichier dont l'extension n'est pas un texte/JSON connu est
    // considéré comme binaire et renvoyé en base64 plutôt que lu en UTF-8
    // (qui corromprait silencieusement un asset binaire hors table MIME).
    const TEXT_EXT = new Set(['.json', '.txt', '.md', '.csv', '.xml', '.yml', '.yaml', '.html', '.css', '.js', '.ts', '.log']);
    if (!TEXT_EXT.has(ext)) {
      const buffer = fs.readFileSync(fullPath);
      return `data:application/octet-stream;base64,${buffer.toString('base64')}`;
    }

    return fs.readFileSync(fullPath,'utf8');
  },

  async exists(relPath: string): Promise<boolean> {
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    return fs.existsSync(fullPath);
  },

  async listBankAssets(): Promise<any[]> {
    const bankRoot = path.join(REGISTRY_ROOT, 'bank');
    if (!fs.existsSync(bankRoot)) return [];
    const items: any[] = [];
    for (const entry of fs.readdirSync(bankRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(bankRoot, entry.name, 'metadata.json');
      if (!fs.existsSync(metaPath)) continue;
      try {
        items.push(JSON.parse(fs.readFileSync(metaPath,'utf8')));
      } catch {
        // metadata.json corrompu : ignoré
      }
    }
    return items;
  },

  async saveFile(relPath: string, content: string) {
    const ts = new Date().toLocaleTimeString();
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // R6 — Écriture atomique : on écrit dans un fichier temporaire puis on
    // rename (opération atomique sur le même FS), évitant toute corruption
    // JSON si deux écritures concurrentes (web→FS + locale) s'entrecroisent.
    const tmpPath = `${fullPath}.${process.pid}.${Date.now()}.tmp`;
    if (content.startsWith('data:')) {
      const base64Data = content.split(',')[1];
      fs.writeFileSync(tmpPath, Buffer.from(base64Data,'base64'));
    } else {
      fs.writeFileSync(tmpPath, content,'utf8');
    }
    fs.renameSync(tmpPath, fullPath);
    console.log(`💾 [REGISTRY_FS] [WRITE] [${ts}] Succès : ${relPath} (${content.length} bytes)`);
  },

  async saveBinary(relPath: string, buffer: Buffer) {
    const ts = new Date().toLocaleTimeString();
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${fullPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, fullPath);
    console.log(`💾 [REGISTRY_FS] [WRITE] [${ts}] Succès (binaire) : ${relPath} (${buffer.length} bytes)`);
  },

  async createFolder(relPath: string) {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  },

  async deleteItem(relPath: string) {
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      console.log(`🗑️ [REGISTRY_FS] [DELETE] Succès : ${relPath}`);
    }
  },

  async renameItem(oldPath: string, newName: string) {
    const oldFullPath = path.join(REGISTRY_ROOT, oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
      console.log(`📝 [REGISTRY_FS] [RENAME] ${oldPath} -> ${newName}`);
    }
  },

  async saveAsset(relPath: string, dataUri: string) {
    await this.saveFile(relPath, dataUri);
  },

  async runDiagnostic() {
    return [
      `[DIAGNOSTIC] ${new Date().toISOString()}`,
      `Registry root exists: ${fs.existsSync(REGISTRY_ROOT)}`,
      `Registry root path: ${REGISTRY_ROOT}`,
    ];
  },

  async getCloudData(projectId: string) {
    const { getPrismaClient } = await import('./prisma-client');
    const prisma = await getPrismaClient();
    return prisma.knowledgeItem.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async upsertCloudData(items: any[]) {
    const { getPrismaClient } = await import('./prisma-client');
    const prisma = await getPrismaClient();
    for (const item of items) {
      const contentStr = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
      let parsed: any = {};
      try {
        parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
      } catch (e) {}

      await prisma.knowledgeItem.upsert({
        where: { id: item.id },
        update: {
          title: item.title || parsed?.title || 'Sans titre',
          type: item.type || parsed?.type || 'document',
          content: contentStr,
          question: item.question || parsed?.question || null,
          answer: item.answer || parsed?.answer || null,
          tags: item.tags || parsed?.tags || [],
          category: item.category || parsed?.category || null,
        },
        create: {
          id: item.id,
          title: item.title || parsed?.title || 'Sans titre',
          type: item.type || parsed?.type || 'document',
          content: contentStr,
          question: item.question || parsed?.question || null,
          answer: item.answer || parsed?.answer || null,
          tags: item.tags || parsed?.tags || [],
          category: item.category || parsed?.category || null,
          userId: item.userId || 'admin-root',
        }
      });
    }
  }
};
