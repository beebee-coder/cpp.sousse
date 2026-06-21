// src/lib/db/types.ts

// Cloud PostgreSQL
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
  content: string; // JSON ou URL
  embedding?: number[]; // Vector embedding
  tags: string[];
  createdAt: Date;
}

// Local ChromaDB
export interface LocalVectorCollection {
  name: string;
  metadata: {
    userId: string;
    projectId: string;
    syncStatus: 'synced' | 'pending' | 'conflict';
    lastSync: Date;
  };
}

export interface LocalVectorPoint {
  id: string;
  values: number[]; // Vector embedding
  metadata: {
    cloudId?: string; // Référence à l'ID cloud
    type: string;
    tags: string[];
    timestamp: Date;
    syncStatus: 'synced' | 'pending' | 'conflict';
  };
}

// SQLite Local (Métadonnées)
export interface LocalMetadata {
  id: string;
  vectorId: string;
  key: string;
  value: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

// État de synchronisation
export interface SyncState {
  userId: string;
  deviceId: string;
  lastSync: Date;
  pendingUploads: number;
  pendingDownloads: number;
  status: 'idle' | 'syncing' | 'error';
}