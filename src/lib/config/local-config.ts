import { isDesktop } from '../platform';

export const localConfig = {
  dbPath: isDesktop ? 'data/metadata.json' : 'visionode_local_metadata',
  maxLocalFiles: 1000,
  syncIntervalMs: 30000, // 30 seconds
};
