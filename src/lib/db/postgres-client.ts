
import fs from 'fs';
import path from 'path';

/**
 * Infrastructure de liaison physique pour le Registre.
 * Supporte désormais la gestion complète des fichiers et répertoires.
 */

const REGISTRY_ROOT = path.join(process.cwd(), 'registry');

// Assure l'existence du répertoire racine
if (!fs.existsSync(REGISTRY_ROOT)) fs.mkdirSync(REGISTRY_ROOT, { recursive: true });

export const postgresClient = {
  /**
   * Récupère l'arborescence complète du répertoire registry/
   */
  getRegistryTree: async (dir = REGISTRY_ROOT): Promise<any[]> => {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    const tree = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(REGISTRY_ROOT, fullPath);
      
      if (entry.isDirectory()) {
        return {
          id: relativePath,
          name: entry.name,
          type: 'folder',
          children: await postgresClient.getRegistryTree(fullPath)
        };
      } else {
        return {
          id: relativePath,
          name: entry.name,
          type: 'file',
          size: fs.statSync(fullPath).size
        };
      }
    }));

    return tree;
  },

  /**
   * Lit le contenu d'un fichier spécifique
   */
  getFile: async (relPath: string) => {
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) throw new Error("FICHIER_INTROUVABLE");
    return fs.readFileSync(fullPath, 'utf8');
  },

  /**
   * Écrit ou met à jour un fichier
   */
  saveFile: async (relPath: string, content: string) => {
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  },

  /**
   * Crée un nouveau répertoire
   */
  createFolder: async (relPath: string) => {
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  },

  /**
   * Supprime un fichier ou un dossier (récursif)
   */
  deleteItem: async (relPath: string) => {
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  },

  /**
   * Méthode legacy pour compatibilité RAG automatique
   */
  upsertCloudData: async (items: any[]): Promise<void> => {
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) fs.mkdirSync(itemsDir, { recursive: true });

    items.forEach(newItem => {
      let parsedContent: any = {};
      try {
        parsedContent = typeof newItem.content === 'string' ? JSON.parse(newItem.content) : newItem.content;
      } catch (e) {
        parsedContent = { raw: newItem.content };
      }

      const baseName = parsedContent.title || newItem.id;
      const safeId = baseName.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
      const filePath = path.join(itemsDir, `${safeId}.json`);

      const dataToSave = {
        id: newItem.id,
        projectId: newItem.projectId,
        type: newItem.type,
        createdAt: newItem.createdAt || new Date().toISOString(),
        ...parsedContent 
      };

      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    });
  },

  /**
   * Méthode legacy pour suppression par IDs
   */
  deleteItems: async (projectId: string, ids: string[]): Promise<void> => {
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) return;
    const files = fs.readdirSync(itemsDir);
    files.forEach(file => {
      const raw = fs.readFileSync(path.join(itemsDir, file), 'utf8');
      const data = JSON.parse(raw);
      if (ids.includes(data.id)) {
        fs.unlinkSync(path.join(itemsDir, file));
      }
    });
  }
};
