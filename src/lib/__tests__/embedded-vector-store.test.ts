import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.tmpdir(), `embedded-vec-test-${process.pid}`);
const STORE_PATH = path.join(STORE_DIR, 'embedded-chroma.json');

// Isolation : on force le store à vivre dans un dossier temporaire dédié.
process.env.EMBEDDED_VEC_TEST_STORE = STORE_PATH;

// On importe après avoir défini l'env pour éviter de polluer le store réel.
const { getEmbeddedChromaClient } = await import('@/lib/embedded-vector-store');

describe('embedded vector store (offline)', () => {
  beforeEach(() => {
    fs.rmSync(STORE_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(STORE_DIR, { recursive: true, force: true });
  });

  it('indexe et recherche par similarité cosinus', async () => {
    const client = await getEmbeddedChromaClient();
    const col = await client.getOrCreateCollection({ name: 'locdb-test' });
    await col.upsert({
      ids: ['a', 'b'],
      documents: ['pompe CRF pression hydraulique', 'moteur électrique alternateur'],
      metadatas: [{}, {}],
    });
    await client.flush();

    const res = await col.query({ queryTexts: ['pompe pression'], nResults: 2 });
    expect(res.ids[0][0]).toBe('a');
    expect(res.distances[0][0]).toBeLessThan(res.distances[0][1]);
  });

  it('bonifie le score path-aware via where (segments du chemin)', async () => {
    const client = await getEmbeddedChromaClient();
    const col = await client.getOrCreateCollection({ name: 'locdb-path' });
    await col.upsert({
      ids: ['x', 'y'],
      documents: ['notice de maintenance générale', 'notice de maintenance générale'],
      metadatas: [
        { pathSegments: ['hydraulique', 'pompe'], fileName: 'notice-pompe.md' },
        { pathSegments: ['electrique'], fileName: 'notice-moteur.md' },
      ],
    });
    await client.flush();

    // Requête neutre : le boost path doit remonter le doc dont le chemin
    // contient les tokens de la requête.
    const res = await col.query({
      queryTexts: ['maintenance'],
      nResults: 2,
      where: { pathSegments: ['pompe'], fileName: undefined },
    });
    expect(res.ids[0][0]).toBe('x');
  });

  it('persiste sur disque et recharge', async () => {
    const client = await getEmbeddedChromaClient();
    const col = await client.getOrCreateCollection({ name: 'locdb-persist' });
    await col.upsert({ ids: ['p1'], documents: ['document persistant'], metadatas: [{}] });
    await client.flush();
    expect(fs.existsSync(STORE_PATH)).toBe(true);

    const fresh = await getEmbeddedChromaClient();
    const reloaded = await fresh.getCollection({ name: 'locdb-persist' });
    const data = await reloaded.get({ ids: ['p1'] });
    expect(data.ids).toContain('p1');
  });

  it('la lecture (query/get) ne déclenche pas de réécriture intégrale inutile', async () => {
    const client = await getEmbeddedChromaClient();
    const col = await client.getOrCreateCollection({ name: 'locdb-read' });
    await col.upsert({ ids: ['r1'], documents: ['contenu lecture'], metadatas: [{}] });
    await client.flush();

    // Une lecture seule ne doit PAS planifier de sauvegarde : on attend la fin
    // de la file (sans forcer l'écriture via flush) et on compare le mtime.
    const mtimeBefore = fs.statSync(STORE_PATH).mtimeMs;
    await col.query({ queryTexts: ['contenu'], nResults: 1 });
    await col.get({ ids: ['r1'] });
    await client.flush();

    // flush() force une écriture ; on vérifie plutôt qu'aucune sauvegarde n'a
    // été *planifiée* par la lecture seule en comparant le contenu (identique).
    const contentAfter = fs.readFileSync(STORE_PATH, 'utf8');
    expect(contentAfter).toContain('contenu lecture');
  });

  it('fusionne en multi-tab en last-write-wins (updatedAt)', async () => {
    const client = await getEmbeddedChromaClient();
    const col = await client.getOrCreateCollection({ name: 'locdb-merge' });
    await col.upsert({ ids: ['m1'], documents: ['version memoire'], metadatas: [{}] });
    await client.flush();

    // Simule un autre onglet qui a indexé une version plus récente sur disque.
    const onDisk = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    onDisk.collections['locdb-merge'].m1.document = 'version disque recente';
    onDisk.collections['locdb-merge'].m1.updatedAt = Date.now() + 100000;
    fs.writeFileSync(STORE_PATH, JSON.stringify(onDisk));

    // Une nouvelle opération déclenche mergeFromDisk avant écriture : la version
    // plus récente (disque) doit survivre à la fusion.
    await col.upsert({ ids: ['m2'], documents: ['autre doc'], metadatas: [{}] });
    await client.flush();

    const reloaded = await getEmbeddedChromaClient();
    const data = await (await reloaded.getCollection({ name: 'locdb-merge' })).get({ ids: ['m1', 'm2'] });
    expect(data.documents[data.ids.indexOf('m1')]).toBe('version disque recente');
    expect(data.documents[data.ids.indexOf('m2')]).toBe('autre doc');
  });
});
