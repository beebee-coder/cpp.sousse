import { isDesktop } from '../platform';

export const localConfig = {
  dbPath: isDesktop ? 'data/metadata.json' : 'visionode_local_metadata',
  vectorDbUrl: process.env.CHROMA_URL || 'http://127.0.0.1:8000',
  maxLocalFiles: 1000,
  syncIntervalMs: 30000, // 30 seconds
};
