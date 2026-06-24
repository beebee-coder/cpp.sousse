
import fs from 'fs';
import path from 'path';

/**
 * Infrastructure de liaison physique pour le Registre.
 * Utilise un dossier caché (.registry) pour éviter de déclencher le watcher de Next.js
 * lors des écritures, empêchant ainsi le rechargement intempestif de la page.
 */

const REGISTRY_ROOT = path.join(process.cwd(), '.registry');

// Assure l'existence du répertoire racine et du sous-dossier items
const ensureRegistry = () => {
  if (!fs.existsSync(REGISTRY_ROOT)) {
    fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
  }
  const itemsDir = path.join(REGISTRY_ROOT, 'items');
  if (!fs.existsSync(itemsDir)) {
    fs.mkdirSync(itemsDir, { recursive: true });
  }
};

export const postgresClient = {
  /**
   * Récupère l'arborescence complète du répertoire .registry/
   */
  getRegistryTree: async (dir = REGISTRY_ROOT): Promise<any[]> => {
    ensureRegistry();
    if (!fs.existsSync(dir)) return [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      const tree = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(REGISTRY_ROOT, fullPath);
        
        // Ignorer les fichiers système cachés à l'exception du dossier racine lui-même
        if (entry.name.startsWith('.') && entry.name !== '.registry') return null;

        if (entry.isDirectory()) {
          const children = await postgresClient.getRegistryTree(fullPath);
          return {
            id: relativePath,
            name: entry.name,
            type: 'folder',
            children
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

      // Filtrer les nulls et trier (dossiers en premier)
      return tree
        .filter(n => n !== null)
        .sort((a: any, b: any) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
    } catch (error) {
      console.error("❌ [postgresClient.getRegistryTree] Erreur :", error);
      return [];
    }
  },

  /**
   * Lit le contenu d'un fichier spécifique
   */
  getFile: async (relPath: string) => {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) throw new Error("FICHIER_INTROUVABLE");
    return fs.readFileSync(fullPath, 'utf8');
  },

  /**
   * Écrit ou met à jour un fichier
   */
  saveFile: async (relPath: string, content: string) => {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  },

  /**
   * Crée un nouveau répertoire (Récursif par défaut)
   */
  createFolder: async (relPath: string) => {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  },

  /**
   * Renomme un fichier ou un dossier
   */
  renameItem: async (oldPath: string, newName: string) => {
    ensureRegistry();
    const oldFullPath = path.join(REGISTRY_ROOT, oldPath);
    const dir = path.dirname(oldFullPath);
    const newFullPath = path.join(dir, newName);
    
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
    } else {
      throw new Error("ÉLÉMENT_SOURCE_INTROUVABLE");
    }
  },

  /**
   * Supprime un fichier ou un dossier (récursif)
   */
  deleteItem: async (relPath: string) => {
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  },

  /**
   * Méthode d'upload de masse pour les captures RAG
   */
  upsertCloudData: async (items: any[]): Promise<void> => {
    ensureRegistry();
    const itemsDir = path.join(REGISTRY_ROOT, 'items');

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

      // Aplatir la structure pour un accès physique direct
      const dataToSave = {
        id: newItem.id,
        projectId: newItem.projectId,
        type: newItem.type,
        createdAt: newItem.createdAt || new Date().toISOString(),
        label: parsedContent.label || parsedContent.question || "",
        details: parsedContent.details || parsedContent.answer || "",
        title: parsedContent.title || baseName,
        metadata: parsedContent.metadata || {}
      };

      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    });
  },

  /**
   * Méthode de suppression par IDs
   */
  deleteItems: async (projectId: string, ids: string[]): Promise<void> => {
    ensureRegistry();
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) return;
    const files = fs.readdirSync(itemsDir);
    files.forEach(file => {
      const fullPath = path.join(itemsDir, file);
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(raw);
        if (ids.includes(data.id)) {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {}
    });
  }
};
