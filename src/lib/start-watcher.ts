import path from 'path';
import { startFileSystemWatcher, stopFileSystemWatcher } from './watcher';

export interface StartWatcherOptions {
  watchDir?: string;
  exts?: string[];
  autoScanOnStart?: boolean;
}

export function installWatcherOnStart(opts?: StartWatcherOptions) {
  const enabled = process.env.SYNC_ENABLE === 'true';
  if (!enabled) {
    console.log('[start-watcher] SYNC_ENABLE != true — watcher disabled. Set SYNC_ENABLE=true to enable.');
    return;
  }

  const watchDir = opts?.watchDir || process.env.SYNC_WATCH_DIR || path.resolve(process.cwd(), 'data');
  const exts = opts?.exts || (process.env.SYNC_EXTS ? process.env.SYNC_EXTS.split(',').map(s => s.trim()) : ['.md', '.txt', '.json']);
  const autoScan = typeof opts?.autoScanOnStart === 'boolean' ? opts!.autoScanOnStart : true;

  try {
    startFileSystemWatcher(watchDir, { includeExtensions: exts, autoScanOnStart: autoScan });
    console.log(`[start-watcher] Watching ${watchDir} (exts: ${exts.join(',')})`);
  } catch (e: any) {
    console.error('[start-watcher] Unable to start watcher:', e?.message || e);
    console.error('[start-watcher] Install chokidar: npm install chokidar');
  }

  async function shutdown() {
    console.log('[start-watcher] Shutting down watcher...');
    try {
      await stopFileSystemWatcher();
    } catch (e) {
      // ignore
    }
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Auto-install when required as main module
if (require.main === module) {
  installWatcherOnStart();
}
