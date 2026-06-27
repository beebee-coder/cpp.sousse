import fs from 'fs';
import path from 'path';

// Optional dependency: chokidar
let chokidar: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  chokidar = require('chokidar');
} catch (e) {
  chokidar = null;
}

import { DocumentToAdd, getChromaClient, upsertDocuments } from './chroma';
import { scanDirectoryToCollections } from './mapper';

let _watcher: any = null;

function normalizeCollectionName(relDir: string) {
  if (!relDir || relDir === '.' || relDir === path.sep) return 'root';
  return relDir.split(path.sep).join('/');
}

/**
 * Start a filesystem watcher that keeps the local Chroma collections in sync.
 * - rootDir: directory to watch
 * - options.includeExtensions: optional array of extensions to include (['.md','.txt'])
 */
export function startFileSystemWatcher(rootDir: string, options?: { includeExtensions?: string[]; autoScanOnStart?: boolean }) {
  if (!chokidar) {
    throw new Error('Missing dependency: chokidar not installed. Run `npm install chokidar`');
  }

  if (_watcher) {
    console.warn('[watcher] Watcher already running.');
    return _watcher;
  }

  const includeExt = options?.includeExtensions?.map(e => e.toLowerCase());

  _watcher = chokidar.watch(rootDir, {
    ignored: /(^|[\\/])\../, // ignore dotfiles
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
  });

  async function handleAddOrChange(absPath: string) {
    try {
      const stat = await fs.promises.stat(absPath);
      if (!stat.isFile()) return;
      const ext = path.extname(absPath).toLowerCase();
      if (includeExt && includeExt.length > 0 && !includeExt.includes(ext)) return;

      let content = '';
      try {
        content = await fs.promises.readFile(absPath, 'utf8');
      } catch {
        // unreadable -> keep empty
        content = '';
      }

      const relPath = path.relative(rootDir, absPath).split(path.sep).join('/');
      const collectionRelDir = path.relative(rootDir, path.dirname(absPath));
      const collectionName = normalizeCollectionName(collectionRelDir);

      const doc: DocumentToAdd = {
        id: relPath,
        content,
        metadata: {
          path: absPath,
          relPath,
          mtime: stat.mtime.toISOString(),
          size: stat.size,
          tags: []
        } as any
      };

      // Upsert via the chroma helper (no-op in cloud mode)
      try {
        await upsertDocuments(collectionName, [doc]);
        console.log(`[watcher] Upserted document ${relPath} -> collection ${collectionName}`);
      } catch (e: any) {
        console.warn(`[watcher] Failed upsert for ${relPath}: ${e?.message || e}`);
        // Try lower-level fallback: direct client call
        try {
          const client: any = await getChromaClient();
          if (client) {
            const col = await client.getOrCreateCollection({ name: collectionName });
            if (col && typeof col.upsert === 'function') {
              await col.upsert({ ids: [doc.id], documents: [doc.content], metadatas: [doc.metadata] });
            }
          }
        } catch (inner: any) {
          console.warn('[watcher] Fallback upsert failed:', inner?.message || inner);
        }
      }
    } catch (err: any) {
      console.warn('[watcher] add/change handler error:', err?.message || err);
    }
  }

  async function handleUnlink(absPath: string) {
    try {
      const relPath = path.relative(rootDir, absPath).split(path.sep).join('/');
      const collectionRelDir = path.relative(rootDir, path.dirname(absPath));
      const collectionName = normalizeCollectionName(collectionRelDir);

      try {
        const client: any = await getChromaClient();
        if (client) {
          const col = await client.getOrCreateCollection({ name: collectionName });
          if (col && typeof col.delete === 'function') {
            await col.delete({ ids: [relPath] });
            console.log(`[watcher] Deleted document ${relPath} from ${collectionName}`);
            return;
          }
        }

        // If no client or delete method, attempt an upsert with empty document (best-effort)
        await upsertDocuments(collectionName, [{ id: relPath, content: '', metadata: { path: absPath, relPath, mtime: new Date().toISOString(), size: 0 } as any }]);
        console.log(`[watcher] Marked document ${relPath} as empty in ${collectionName}`);
      } catch (e: any) {
        console.warn(`[watcher] Failed deleting ${relPath}: ${e?.message || e}`);
      }
    } catch (err: any) {
      console.warn('[watcher] unlink handler error:', err?.message || err);
    }
  }

  _watcher.on('add', handleAddOrChange);
  _watcher.on('change', handleAddOrChange);
  _watcher.on('unlink', handleUnlink);

  _watcher.on('error', (err: any) => console.error('[watcher] chokidar error', err));

  if (options?.autoScanOnStart) {
    // Perform an initial scan and upsert all documents found
    (async () => {
      try {
        const snapshot = await scanDirectoryToCollections(rootDir, { includeExtensions: options?.includeExtensions });
        for (const [collectionName, docs] of Object.entries(snapshot)) {
          const docsForUpsert = docs.map(d => ({ id: d.id, content: d.content, metadata: d.metadata }));
          try {
            await upsertDocuments(collectionName, docsForUpsert);
            console.log(`[watcher] Initial upsert for collection ${collectionName}: ${docsForUpsert.length} docs`);
          } catch (e) {
            console.warn(`[watcher] Initial upsert failed for ${collectionName}:`, e);
          }
        }
      } catch (e) {
        console.warn('[watcher] Initial scan failed:', e);
      }
    })();
  }

  console.log(`[watcher] Watching ${rootDir}`);
  return _watcher;
}

export async function stopFileSystemWatcher() {
  if (!_watcher) return;
  try {
    await _watcher.close();
    _watcher = null;
    console.log('[watcher] Stopped');
  } catch (e) {
    console.warn('[watcher] Error stopping:', e);
  }
}
