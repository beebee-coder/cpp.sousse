import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Liaison physique pour le Registre local [REGISTRY_FS].
 * Version : Scan récursif pour synchronisation réelle de l'Explorateur BDD.
 */

const REGISTRY_ROOT = path.join(process.cwd(), '.registry');

const ensureRegistry = () => {
  if (!fs.existsSync(REGISTRY_ROOT)) {
    fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
  }
  const dirs = ['items', 'bank', 'procedures'];
  dirs.forEach(dir => {
    const target = path.join(REGISTRY_ROOT, dir);
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  });
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
    
    const ext = path.extname(fullPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.mp4'].includes(ext)) {
      const buffer = fs.readFileSync(fullPath);
      const mime = ext === '.mp4' ? 'video/mp4' : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
    
    return fs.readFileSync(fullPath, 'utf8');
  },

  async saveFile(relPath: string, content: string) {
    const ts = new Date().toLocaleTimeString();
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (content.startsWith('data:')) {
      const base64Data = content.split(',')[1];
      fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
    } else {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    console.log(`💾 [REGISTRY_FS] [WRITE] [${ts}] Succès : ${relPath} (${content.length} bytes)`);
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
    const { prisma } = await import('./prisma-client');
    return prisma.knowledgeItem.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async upsertCloudData(items: any[]) {
    const { prisma } = await import('./prisma-client');
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
