
import fs from 'fs';
import path from 'path';

/**
 * Infrastructure de liaison physique pour le Registre.
 * Utilise un dossier 'registry' à la racine.
 */

const REGISTRY_ROOT = path.join(process.cwd(), 'registry');

const ensureRegistry = () => {
  try {
    if (!fs.existsSync(REGISTRY_ROOT)) {
      fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
    }
    const itemsDir = path.join(REGISTRY_ROOT, 'items');
    if (!fs.existsSync(itemsDir)) {
      fs.mkdirSync(itemsDir, { recursive: true });
    }
  } catch (e) {
    console.error("❌ [ensureRegistry] Échec d'accès disque :", e);
  }
};

export const postgresClient = {
  /**
   * Récupère l'arborescence complète du répertoire registry/
   */
  getRegistryTree: async (dir = REGISTRY_ROOT): Promise<any[]> => {
    ensureRegistry();
    if (!fs.existsSync(dir)) return [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      const tree = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(REGISTRY_ROOT, fullPath).replace(/\\/g, '/');
        
        // Ignorer les fichiers système cachés
        if (entry.name.startsWith('.')) return null;

        if (entry.isDirectory()) {
          const children = await postgresClient.getRegistryTree(fullPath);
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
   * Crée un nouveau répertoire
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
   * Supprime physiquement un fichier ou un dossier (récursif et forcé)
   */
  deleteItem: async (relPath: string) => {
    ensureRegistry();
    // Sécurité : Empêcher la sortie de la racine registry/
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (!safePath || safePath === '.' || safePath === '/') {
      throw new Error("ACCES_INTERDIT_RACINE");
    }
    
    const fullPath = path.join(REGISTRY_ROOT, safePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        // rmSync avec recursive et force est l'alternative la plus robuste
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`🗑️ [postgresClient] Suppression physique réussie : ${fullPath}`);
      } catch (err: any) {
        throw new Error(`ERREUR_FS_DELETE : ${err.message}`);
      }
    } else {
      console.warn(`⚠️ [postgresClient] Élément déjà absent du disque : ${fullPath}`);
    }
  },

  /**
   * Méthode d'upload pour les captures RAG
   */
  upsertCloudData: async (items: any[]): Promise<void> => {
    ensureRegistry();
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
        label: parsedContent.label || parsedContent.question || "",
        details: parsedContent.details || parsedContent.answer || "",
        title: parsedContent.title || baseName,
        metadata: parsedContent.metadata || {}
      };

      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    });
  }
};
