import { LocalMetadata } from './types';

/**
 * Client persistant local (simule SQLite via LocalStorage pour le mode hybride).
 * En mode Desktop pur, pourrait être remplacé par le plugin Tauri SQL.
 */
const STORAGE_KEY = 'visionode_local_metadata_db';

function load(): LocalMetadata[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function save(data: LocalMetadata[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const sqliteClient = {
  getAll: async () => load(),
  
  getPending: async () => {
    return load().filter(m => m.syncStatus === 'pending');
  },

  upsert: async (item: LocalMetadata) => {
    const data = load();
    const idx = data.findIndex(m => m.id === item.id);
    if (idx !== -1) {
      data[idx] = item;
    } else {
      data.push(item);
    }
    save(data);
  },

  clear: async () => save([])
};
