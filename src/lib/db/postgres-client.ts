
import fs from 'fs';
import path from 'path';

/**
 * Liaison physique pour le Registre local [REGISTRY_FS].
 */
const REGISTRY_ROOT = path.join(process.cwd(), '.registry');

const ensureRegistry = () => {
  if (!fs.existsSync(REGISTRY_ROOT)) {
    fs.mkdirSync(REGISTRY_ROOT, { recursive: true });
  }
  ['items', 'bank', 'procedures'].forEach(dir => {
    const target = path.join(REGISTRY_ROOT, dir);
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  });
};

export const postgresClient = {
  async getRegistryTree(): Promise<any[]> {
    ensureRegistry();
    // Logique simplifiée pour l'exemple
    return [];
  },

  async getFile(relPath: string) {
    const ts = new Date().toLocaleTimeString();
    console.log(`📖 [REGISTRY_FS] [READ] [${ts}] Lecture : ${relPath}`);
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    if (!fs.existsSync(fullPath)) throw new Error("FICHIER_INTROUVABLE");
    return fs.readFileSync(fullPath, 'utf8');
  },

  async saveFile(relPath: string, content: string) {
    const ts = new Date().toLocaleTimeString();
    ensureRegistry();
    const fullPath = path.join(REGISTRY_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`💾 [REGISTRY_FS] [WRITE] [${ts}] Succès : ${relPath} (${content.length} bytes)`);
  }
};
