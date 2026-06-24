
import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Liaison physique pour le Registre local.
 * Utilise un dossier caché '.registry' pour éviter les rechargements Next.js.
 */

const REGISTRY_ROOT = path.join(process.cwd(), '.registry');

const ensureRegistry = () => {
  try {
    if (!fs.existsSync(REGISTRY_ROOT)) {
      fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
    }
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) {
      fs.mkdirSync(itemsDir, { recursive: true });
    }
    const bankDir = path.join(REGISTRY_ROOT, 'bank');
    if (!fs.existsSync(bankDir)) {
      fs.mkdirSync(bankDir, { recursive: true });
    }
  } catch (e) {
    console.error("❌ [postgresClient] Erreur accès disque :", e);
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
    const fullPath = path.join(REGISTRY_ROOT, relPath);
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
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  },

  async saveAsset(relPath: string, base64Data: string) {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const base64Content = base64Data.split(';base64,').pop();
    if (base64Content) {
      fs.writeFileSync(fullPath, Buffer.from(base64Content, 'base64'));
    }
  },

  async createFolder(relPath: string) {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  },

  async renameItem(oldPath: string, newName: string) {
    ensureRegistry();
    const oldFullPath = path.join(REGISTRY_ROOT, oldPath);
    const dir = path.dirname(oldFullPath);
    const newFullPath = path.join(dir, newName);
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
    } else {
      throw new Error("SOURCE_INTROUVABLE");
    }
  },

  async deleteItem(relPath: string) {
    ensureRegistry();
    // Normalize path and prevent directory traversal
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (!safePath || safePath === '.' || safePath === '/') throw new Error("ACCES_INTERDIT_RACINE");
    
    const fullPath = path.join(REGISTRY_ROOT, safePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        // Radical recursive deletion
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`✅ [POSTGRES_CLIENT] Suppression physique radicale : ${fullPath}`);
      } catch (e: any) {
        console.error(`❌ [POSTGRES_CLIENT] Échec suppression système : ${e.message}`);
        throw new Error(`ERREUR_SYSTEME_FICHIER : ${e.message}`);
      }
    } else {
      throw new Error("ELEMENT_DEJA_ABSENT_DU_DISQUE");
    }
  },

  async upsertCloudData(items: any[]): Promise<void> {
    ensureRegistry();
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) fs.mkdirSync(itemsDir, { recursive: true });

    items.forEach(newItem => {
      const parsed = typeof newItem.content === 'string' ? JSON.parse(newItem.content) : newItem.content;
      const baseName = parsed.title || newItem.id;
      const safeId = baseName.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
      const filePath = path.join(itemsDir, `${safeId}.json`);
      fs.writeFileSync(filePath, JSON.stringify({
        ...newItem,
        label: parsed.label || "",
        details: parsed.details || "",
        title: parsed.title || baseName
      }, null, 2));
    });
  }
};
