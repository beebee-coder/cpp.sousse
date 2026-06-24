import fs from 'fs';
import path from 'path';

/**
 * Infrastructure de liaison physique pour le Registre Cloud simulé.
 * En environnement de développement (Firebase Studio/Local), 
 * utilise le système de fichiers pour garantir une persistance réelle.
 */

const REGISTRY_DIR = path.join(process.cwd(), 'registry');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'cloud_registry.json');

// Assure l'existence du dossier de registre physique
if (!fs.existsSync(REGISTRY_DIR)) {
  fs.mkdirSync(REGISTRY_DIR, { recursive: true });
}

if (!fs.existsSync(REGISTRY_FILE)) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify([], null, 2));
}

export const postgresClient = {
  /**
   * Récupère les données depuis le fichier JSON physique (Simulation Neon).
   */
  getCloudData: async (projectId: string, lastSyncDate?: Date): Promise<any[]> => {
    try {
      const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
      const allData: any[] = JSON.parse(raw);
      
      const projectData = allData.filter(d => d.projectId === projectId);
      
      if (lastSyncDate) {
        const threshold = lastSyncDate.getTime();
        return projectData.filter(d => new Date(d.createdAt).getTime() > threshold);
      }
      return projectData;
    } catch (e) {
      console.error("❌ [NEON_FS] Erreur lecture registre :", e);
      return [];
    }
  },

  /**
   * Insère les données physiquement sur le disque.
   */
  upsertCloudData: async (items: any[]): Promise<void> => {
    try {
      const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
      const existing: any[] = JSON.parse(raw);
      
      const newRegistry = [...existing];

      items.forEach(newItem => {
        const idx = newRegistry.findIndex(d => d.id === newItem.id);
        const dataToSave = {
          ...newItem,
          createdAt: newItem.createdAt || new Date().toISOString()
        };

        if (idx !== -1) {
          newRegistry[idx] = dataToSave;
        } else {
          newRegistry.push(dataToSave);
        }
      });

      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(newRegistry, null, 2));
      console.log(`✅ [NEON_FS] ${items.length} items synchronisés physiquement dans registry/cloud_registry.json`);
    } catch (e) {
      console.error("❌ [NEON_FS] Erreur écriture registre :", e);
      throw new Error("REGISTRY_WRITE_FAILED");
    }
  },

  /**
   * Supprime des items du registre physique.
   */
  deleteItems: async (projectId: string, ids: string[]): Promise<void> => {
    try {
      const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
      const allData: any[] = JSON.parse(raw);
      const filtered = allData.filter(d => !(d.projectId === projectId && ids.includes(d.id)));
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(filtered, null, 2));
    } catch (e) {
      console.error("❌ [NEON_FS] Erreur purge registre :", e);
    }
  }
};
