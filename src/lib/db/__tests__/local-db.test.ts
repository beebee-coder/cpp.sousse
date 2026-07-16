import { describe, it, expect, vi, beforeEach } from 'vitest';
import { localDB } from '../local-db';
import fs from 'fs';
import path from 'path';

const TEST_REGISTRY = path.join(process.cwd(), '.local-db');

vi.mock('../postgres-client', () => ({
  postgresClient: {}
}));

describe('LocalDB Service', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_REGISTRY)) {
      fs.rmSync(TEST_REGISTRY, { recursive: true, force: true });
    }
  });

  it('initializes the directory structure', async () => {
    await localDB.initialize();
    expect(fs.existsSync(path.join(TEST_REGISTRY, 'INDEX_CHROMA'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_REGISTRY, 'Centrale'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_REGISTRY, 'local-db-manifest.json'))).toBe(true);
  });

  it('injects a unique file directly in INDEX_CHROMA', async () => {
    const result = await localDB.injectFile('my-doc.json', '{"test": true}');
    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.path).toBe('INDEX_CHROMA/my-doc.json');
    expect(fs.existsSync(path.join(TEST_REGISTRY, 'INDEX_CHROMA', 'my-doc.json'))).toBe(true);
  });

  it('moves first file and indexes duplicates', async () => {
    await localDB.injectFile('dup.txt', 'contenu 1');
    const result = await localDB.injectFile('dup.txt', 'contenu 2');

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.path).toBe('INDEX_CHROMA/dup.txt/2_dup.txt');
    expect(fs.existsSync(path.join(TEST_REGISTRY, 'INDEX_CHROMA', 'dup.txt', '1_dup.txt'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_REGISTRY, 'INDEX_CHROMA', 'dup.txt', '2_dup.txt'))).toBe(true);
  });

  it('indexes third duplicate as 3_X', async () => {
    await localDB.injectFile('triple.log', 'v1');
    await localDB.injectFile('triple.log', 'v2');
    const result = await localDB.injectFile('triple.log', 'v3');

    expect(result.path).toBe('INDEX_CHROMA/triple.log/3_triple.log');
  });

  it('returns the full arborescence tree', async () => {
    await localDB.injectFile('tree-test.json', '{"hello": "world"}');
    const tree = await localDB.getTree();

    const rootNames = tree.map(n => n.id);
    expect(rootNames).toContain('INDEX_CHROMA');
    expect(rootNames).toContain('Centrale');
  });

  it('reads file content by path', async () => {
    await localDB.injectFile('read-test.txt', 'hello world');
    const content = await localDB.getFile('INDEX_CHROMA/read-test.txt');
    expect(content).toBe('hello world');
  });

  it('searches files by query', async () => {
    await localDB.injectFile('search-doc.json', '{"a": 1}', { knowledgeType: 'qa', tags: ['tag1', 'tag2'] });
    const results = await localDB.searchByQuery('tag1');
    expect(results.length).toBe(1);
    expect(results[0].originalName).toBe('search-doc.json');
  });
});
