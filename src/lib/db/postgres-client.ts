import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Liaison physique pour le Registre local.
 * Utilise un dossier caché '.registry' pour éviter les rechargements Next.js intempestifs.
 */

const REGISTRY_ROOT = path.join(process.cwd(), '.registry');

const ensureRegistry = () => {
  try {
    if (!fs.existsSync(REGISTRY_ROOT)) {
      console.log("📁 [PG_CLIENT] Création racine .registry/");
      fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
    }
    // Dossiers de base du registre industriel
    const dirs = ['items', 'bank', 'procedures'];
    dirs.forEach(dir => {
      const target = path.join(REGISTRY_ROOT, dir);
      if (!fs.existsSync(target)) {
        console.log(`📁 [PG_CLIENT] Création dossier base: ${dir}`);
        fs.mkdirSync(target, { recursive: true });
      }
    });
  } catch (e) {
    console.error("❌ [PG_CLIENT] Erreur accès disque critique :", e);
  }
};

export const postgresClient = {
  async getRegistryTree(dir = REGISTRY_ROOT): Promise<any[]> {
    ensureRegistry();
    if (!fs.existsSync(dir)) return [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const tree = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(REGISTRY_ROOT, fullPath).replace(/\\/g, '/');
        
        if (entry.name === '.DS_Store' || entry.name.startsWith('.')) return null;

        if (entry.isDirectory()) {
          const children = await this.getRegistryTree(fullPath);
          return {
            id: relativePath,
            name: entry.name,
            type: 'folder',
            children: children || []
          };
        } else {
          const stats = fs.statSync(fullPath);
          return {
            id: relativePath,
            name: entry.name,
            type: 'file',
            size: stats.size
          };
        }
      }));

      return tree
        .filter((n): n is any => n !== null)
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
    } catch (error) {
      return [];
    }
  },

  async getFile(relPath: string) {
    ensureRegistry();
    const cleanRelPath = relPath.startsWith('/') ? relPath.substring(1) : relPath;
    const fullPath = path.join(REGISTRY_ROOT, cleanRelPath);
    if (!fs.existsSync(fullPath)) throw new Error("FICHIER_INTROUVABLE");
    
    const ext = path.extname(fullPath).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const videoExtensions = ['.mp4', '.webm', '.ogg'];
    
    if (imageExtensions.includes(ext)) {
      const buffer = fs.readFileSync(fullPath);
      const mimeType = ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    if (videoExtensions.includes(ext)) {
      const buffer = fs.readFileSync(fullPath);
      const mimeType = ext === '.webm' ? 'video/webm' : 'video/mp4';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
    
    return fs.readFileSync(fullPath, 'utf8');
  },

  async saveFile(relPath: string, content: string) {
    ensureRegistry();
    const cleanRelPath = relPath.startsWith('/') ? relPath.substring(1) : relPath;
    const fullPath = path.join(REGISTRY_ROOT, cleanRelPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      console.log(`📁 [PG_CLIENT] Création auto de répertoire: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`💾 [PG_CLIENT] Fichier écrit: ${relPath} (${content.length} octets)`);
  },

  async saveAsset(relPath: string, base64Data: string) {
    ensureRegistry();
    const cleanRelPath = relPath.startsWith('/') ? relPath.substring(1) : relPath;
    const fullPath = path.join(REGISTRY_ROOT, cleanRelPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const base64Content = base64Data.split(';base64,').pop();
    if (base64Content) {
      fs.writeFileSync(fullPath, Buffer.from(base64Content, 'base64'));
      console.log(`💾 [PG_CLIENT] Actif binaire écrit: ${relPath}`);
    }
  },

  async createFolder(relPath: string) {
    ensureRegistry();
    const cleanRelPath = relPath.startsWith('/') ? relPath.substring(1) : relPath;
    const fullPath = path.join(REGISTRY_ROOT, cleanRelPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 [PG_CLIENT] Répertoire créé: ${relPath}`);
    }
  },

  async renameItem(oldPath: string, newName: string) {
    ensureRegistry();
    const cleanOldPath = oldPath.startsWith('/') ? oldPath.substring(1) : oldPath;
    const oldFullPath = path.join(REGISTRY_ROOT, cleanOldPath);
    const dir = path.dirname(oldFullPath);
    const newFullPath = path.join(dir, newName);
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
      console.log(`🔄 [PG_CLIENT] Renommage: ${oldPath} -> ${newName}`);
    } else {
      throw new Error("SOURCE_INTROUVABLE");
    }
  },

  async deleteItem(relPath: string) {
    ensureRegistry();
    const cleanRelPath = relPath.startsWith('/') ? relPath.substring(1) : relPath;
    const safePath = path.normalize(cleanRelPath).replace(/^(\.\.(\/|\\|$))+/, '');
    
    if (!safePath || safePath === '.' || safePath === '/') throw new Error("ACCES_INTERDIT_RACINE");
    
    const fullPath = path.join(REGISTRY_ROOT, safePath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`🗑️ [PG_CLIENT] Élément supprimé: ${relPath}`);
    }
  },

  async upsertCloudData(items: any[]): Promise<void> {
    ensureRegistry();
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) fs.mkdirSync(itemsDir, { recursive: true });

    items.forEach(newItem => {
      const parsed = typeof newItem.content === 'string' ? JSON.parse(newItem.content) : newItem.content;
      const baseName = parsed.title || parsed.label || newItem.id;
      const safeId = baseName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
        
      const filePath = path.join(itemsDir, `${safeId}.json`);
      fs.writeFileSync(filePath, JSON.stringify({
        ...newItem,
        label: parsed.label || "",
        details: parsed.details || "",
        title: parsed.title || baseName
      }, null, 2));
      console.log(`📥 [PG_CLIENT] Cloud Item indexé: ${safeId}.json`);
    });
  },

  async runDiagnostic() {
    console.log("📋 [PG_CLIENT] Diagnostic du registre physique...");
    const report = {
      rootExists: fs.existsSync(REGISTRY_ROOT),
      subdirs: {
        items: fs.existsSync(path.join(REGISTRY_ROOT, 'items')),
        bank: fs.existsSync(path.join(REGISTRY_ROOT, 'bank')),
        procedures: fs.existsSync(path.join(REGISTRY_ROOT, 'procedures'))
      },
      counts: {
        items: fs.existsSync(path.join(REGISTRY_ROOT, 'items')) ? fs.readdirSync(path.join(REGISTRY_ROOT, 'items')).length : 0,
        bank: fs.existsSync(path.join(REGISTRY_ROOT, 'bank')) ? fs.readdirSync(path.join(REGISTRY_ROOT, 'bank')).length : 0,
        procedures: fs.existsSync(path.join(REGISTRY_ROOT, 'procedures')) ? fs.readdirSync(path.join(REGISTRY_ROOT, 'procedures')).length : 0
      }
    };
    console.log("✅ [PG_CLIENT] Diagnostic terminé:", JSON.stringify(report));
    return report;
  }
};
