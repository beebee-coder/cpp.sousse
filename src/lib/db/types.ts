// src/lib/db/types.ts

// Cloud PostgreSQL (Entités Centrales)
export interface CloudUser {
  id: string;
  email: string;
  organization: string;
  createdAt: Date;
  lastSync: Date;
}

export interface CloudProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudData {
  id: string;
  projectId: string;
  type: 'image' | 'video' | 'document' | 'metadata';
  content: string; // JSON stringified ou URL
  embedding?: number[]; // Vecteur associé
  tags: string[];
  createdAt: Date;
}

// Local Vector Data (ChromaDB)
export interface LocalVectorPoint {
  id: string;
  values: number[];
  metadata: {
    cloudId?: string;
    type: string;
    tags: string[];
    timestamp: number;
    syncStatus: 'synced' | 'pending' | 'conflict';
  };
}

// Local Metadata (SQLite / Persistence Locale)
export interface LocalMetadata {
  id: string;
  vectorId: string;
  key: string;
  value: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

// État de synchronisation UI
export interface SyncState {
  userId: string;
  deviceId: string;
  lastSync: Date;
  pendingUploads: number;
  pendingDownloads: number;
  status: 'idle' | 'syncing' | 'error';
}

export type SyncProfile = 'admin-pc' | 'admin-mobile' | 'user-web' | 'user-local-web';
