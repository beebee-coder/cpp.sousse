import { LocalMetadata } from './types';

// Browser-safe local metadata database store using localStorage
const STORAGE_KEY = 'visionode_local_sqlite_metadata';

function loadLocalData(): LocalMetadata[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load local SQLite metadata:', e);
    return [];
  }
}

function saveLocalData(data: LocalMetadata[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local SQLite metadata:', e);
  }
}

export const sqliteClient = {
  getAll: async (): Promise<LocalMetadata[]> => {
    return loadLocalData();
  },

  getById: async (id: string): Promise<LocalMetadata | null> => {
    const list = loadLocalData();
    return list.find(m => m.id === id) || null;
  },

  getByVectorId: async (vectorId: string): Promise<LocalMetadata[]> => {
    const list = loadLocalData();
    return list.filter(m => m.vectorId === vectorId);
  },

  upsert: async (item: LocalMetadata): Promise<void> => {
    const list = loadLocalData();
    const idx = list.findIndex(m => m.id === item.id);
    if (idx !== -1) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    saveLocalData(list);
  },

  delete: async (id: string): Promise<void> => {
    const list = loadLocalData();
    const filtered = list.filter(m => m.id !== id);
    saveLocalData(filtered);
  },

  clear: async (): Promise<void> => {
    saveLocalData([]);
  }
};
