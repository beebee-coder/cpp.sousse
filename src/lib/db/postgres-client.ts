
import fs from 'fs';
import path from 'path';

/**
 * Infrastructure de liaison physique pour le Registre Cloud (simulé).
 * Stocke chaque document comme un fichier JSON individuel pour une visibilité maximale.
 */

const REGISTRY_DIR = path.join(process.cwd(), 'registry');
const ITEMS_DIR = path.join(REGISTRY_DIR, 'items');

// Assure l'existence des répertoires physiques
if (!fs.existsSync(REGISTRY_DIR)) fs.mkdirSync(REGISTRY_DIR, { recursive: true });
if (!fs.existsSync(ITEMS_DIR)) fs.mkdirSync(ITEMS_DIR, { recursive: true });

export const postgresClient = {
  /**
   * Récupère les données en scannant le dossier registry/items/.
   */
  getCloudData: async (projectId: string, lastSyncDate?: Date): Promise<any[]> => {
    try {
      if (!fs.existsSync(ITEMS_DIR)) return [];
      
      const files = fs.readdirSync(ITEMS_DIR);
      const items: any[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const raw = fs.readFileSync(path.join(ITEMS_DIR, file), 'utf8');
        const data = JSON.parse(raw);
        
        if (data.projectId === projectId) {
          if (lastSyncDate) {
            if (new Date(data.createdAt).getTime() > lastSyncDate.getTime()) {
              items.push(data);
            }
          } else {
            items.push(data);
          }
        }
      }
      return items;
    } catch (e) {
      console.error("❌ [NEON_FS] Erreur lecture dossier items :", e);
      return [];
    }
  },

  /**
   * Insère chaque item dans un fichier JSON physique distinct.
   */
  upsertCloudData: async (items: any[]): Promise<void> => {
    try {
      items.forEach(newItem => {
        const id = newItem.id.replace(/[^a-zA-Z0-9-]/g, '_');
        const filePath = path.join(ITEMS_DIR, `${id}.json`);
        const dataToSave = {
          ...newItem,
          createdAt: newItem.createdAt || new Date().toISOString()
        };
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      });
      console.log(`✅ [NEON_FS] ${items.length} fichiers JSON créés dans registry/items/`);
    } catch (e) {
      console.error("❌ [NEON_FS] Erreur écriture fichiers items :", e);
      throw new Error("REGISTRY_WRITE_FAILED");
    }
  },

  /**
   * Supprime physiquement les fichiers du disque.
   */
  deleteItems: async (projectId: string, ids: string[]): Promise<void> => {
    try {
      ids.forEach(id => {
        const safeId = id.replace(/[^a-zA-Z0-9-]/g, '_');
        const filePath = path.join(ITEMS_DIR, `${safeId}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (e) {
      console.error("❌ [NEON_FS] Erreur purge fichiers items :", e);
    }
  }
};
