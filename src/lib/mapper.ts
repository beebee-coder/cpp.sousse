import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { DocumentToAdd } from './chroma';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * Types for the sync mapper
 */
export interface DocumentMeta {
  path: string; // absolute path
  relPath: string; // path relative to scan root
  mtime: string; // ISO string
  size: number; // bytes
  tags?: string[];
}

export interface DocumentInfo extends DocumentToAdd {
  metadata: DocumentMeta;
}

export type CollectionsSnapshot = Record<string, DocumentInfo[]>;

/**
 * Normalise collection name from a directory relative path.
 * Example: "" -> "root", "docs/manuals" -> "docs/manuals"
 */
function normalizeCollectionName(relDir: string) {
  if (!relDir || relDir === '.' || relDir === path.sep) return 'root';
  return relDir.split(path.sep).join('/');
}

/**
 * Scan a directory recursively and build a collections -> documents snapshot.
 * Follows the mapping: folders -> collections, files -> documents.
 * Options: includeExtensions (e.g. ['.md','.txt']) to limit scanned files. If omitted, all files are included.
 */
export async function scanDirectoryToCollections(rootDir: string, options?: { includeExtensions?: string[] }): Promise<CollectionsSnapshot> {
  const includeExt = options?.includeExtensions?.map(e => e.toLowerCase());
  const result: CollectionsSnapshot = {};

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }

      if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (includeExt && includeExt.length > 0 && !includeExt.includes(ext)) continue;

        let content = '';
        try {
          content = await fs.promises.readFile(abs, { encoding: 'utf8' });
        } catch {
          // binary or unreadable — keep empty content, metadata still provided
          content = '';
        }

        const s = await stat(abs);
        const relPath = path.relative(rootDir, abs);
        const collectionRelDir = path.relative(rootDir, path.dirname(abs));
        const collectionName = normalizeCollectionName(collectionRelDir);

        const doc: DocumentInfo = {
          id: relPath.split(path.sep).join('/'),
          content,
          metadata: {
            path: abs,
            relPath: relPath.split(path.sep).join('/'),
            mtime: s.mtime.toISOString(),
            size: s.size,
            tags: []
          }
        };

        if (!result[collectionName]) result[collectionName] = [];
        result[collectionName].push(doc);
      }
    }
  }

  await walk(rootDir);
  return result;
}

/**
 * Helper to convert a single collection's DocumentInfo[] into DocumentToAdd[] for upsert/ingest.
 */
export function toDocumentsForCollection(docs: DocumentInfo[]): DocumentToAdd[] {
  return docs.map(d => ({ id: d.id, content: d.content, metadata: d.metadata }));
}
