export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';
import { localDB } from '@/lib/db/local-db';
import { getSessionFromCookie } from '@/lib/session';
import { put, list, del } from '@vercel/blob';

/**
 * API Route pour la Banque d'Images.
 * Sauvegarde l'actif binaire et ses métadonnées de manière atomique.
 *
 * Stockage :
 *  - Auto-hébergé / Desktop (Node, FS writable) : `.registry/bank/{nom}/`.
 *  - Vercel serverless (FS read-only)           : Vercel Blob si BLOB_READ_WRITE_TOKEN
 *    est défini, sinon rejet propre (pas de 500).
 */
const isCloudServerless = !!process.env.VERCEL;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// Garde-fou anti-abus : 50 Mo max par actif (base64 décodé).
const MAX_ASSET_BYTES = 50 * 1024 * 1024;

// Correspondance MIME -> extension réelle (évite l'écrasement webm -> .mp4).
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

interface BankBody {
  name?: string;
  type?: string;
  data?: string;
  metadata?: any;
}

function parseDataUri(data: string): { mime: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(data);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

export const POST = createHybridRoute<BankBody, any>({
  name: 'BANK_SAVE',
  webHandler: async (req, body) => {
    // [Point 1] Authentification obligatoire (comme les routes sœurs).
    const session = await getSessionFromCookie();
    if (!session) {
      return new Response(JSON.stringify({ error: 'NON_AUTHENTIFIÉ' }), { status: 401 });
    }

    const { name, type, data, metadata } = body;

    // [Point 4/8] Présence et validité des champs.
    if (!name || !data) {
      return new Response(JSON.stringify({ error: 'DONNEES_MANQUANTES' }), { status: 400 });
    }
    if (type !== 'image' && type !== 'video') {
      return new Response(JSON.stringify({ error: 'TYPE_INVALIDE' }), { status: 400 });
    }

    // [Point 5] Vérification du format data URI + MIME réel.
    const parsed = parseDataUri(data);
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'FORMAT_ATTENDU_DATA_URI' }), { status: 400 });
    }
    const { mime, base64 } = parsed;
    const extension = MIME_EXT[mime];
    if (!extension) {
      return new Response(JSON.stringify({ error: 'MIME_NON_SUPPORTE', mime }), { status: 400 });
    }
    if (type === 'image' && !mime.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'TYPE_INCOHÉRENT_IMAGE' }), { status: 400 });
    }
    if (type === 'video' && !mime.startsWith('video/')) {
      return new Response(JSON.stringify({ error: 'TYPE_INCOHÉRENT_VIDEO' }), { status: 400 });
    }

    // [Point 6] Garde de taille du payload décodé.
    const sizeBytes = Buffer.byteLength(base64, 'base64');
    if (sizeBytes > MAX_ASSET_BYTES) {
      return new Response(JSON.stringify({ error: 'DEPASSEMENT_TAILLE', max: MAX_ASSET_BYTES }), { status: 413 });
    }

    // [Point 4] Nom sûr : un nom ne contenant que des non-alphanum -> rejet.
    const safeName = name.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
    if (!safeName) {
      return new Response(JSON.stringify({ error: 'NOM_INVALIDE' }), { status: 400 });
    }

    const folderPath = `bank/${safeName}`;
    const assetPath = `${folderPath}/${safeName}.${extension}`;
    const metaPath = `${folderPath}/metadata.json`;

    // [Point 3] Protection anti-écrasement.
    if (await postgresClient.exists(assetPath)) {
      return new Response(JSON.stringify({ error: 'ACTIF_EXISTANT', path: assetPath }), { status: 409 });
    }

    const finalMetadata = {
      ...metadata,
      name: safeName,
      type,
      mime,
      path: assetPath,
      size: sizeBytes,
      author: session.user.id,
      created_at: new Date().toISOString(),
    };

    // [C1/C2] Cloud serverless : écriture dans Vercel Blob (binaire + métadonnées).
    if (isCloudServerless) {
      if (!BLOB_TOKEN) {
        return { success: false, error: 'BANK_WRITE_CLOUD_UNSUPPORTED' };
      }
      try {
        const binary = Buffer.from(base64, 'base64');
        const [assetBlob, metaBlob] = await Promise.all([
          put(assetPath, binary, {
            access: 'public',
            addRandomSuffix: false,
            token: BLOB_TOKEN,
            contentType: mime,
          }),
          put(metaPath, JSON.stringify(finalMetadata, null, 2), {
            access: 'public',
            addRandomSuffix: false,
            token: BLOB_TOKEN,
            contentType: 'application/json',
          }),
        ]);

        // [RAG_CLOUD] Indexation sémantique dans Weaviate afin que la banque
        // soit recherchable par le RAG en mode cloud (FS read-only, pas de Chroma).
        try {
          const { upsertBankAsset } = await import('@/lib/weaviate/weaviate-bank');
          await upsertBankAsset({
            assetId: safeName,
            name: safeName,
            type: type as 'image' | 'video',
            description: (metadata?.description as string) || '',
            tags: (metadata?.tags as string[]) || [],
            mime,
            url: assetBlob.url,
            createdAt: finalMetadata.created_at,
          });
        } catch (weavErr: any) {
          console.warn('[BANK_SAVE] Indexation Weaviate ignorée :', weavErr?.message);
        }

        return { success: true, path: folderPath, url: assetBlob.url, metaUrl: metaBlob.url, cloud: true };
      } catch (error: any) {
        // [Point 7] Pas de fuite du message interne.
        console.error('[BANK_SAVE] Échec Blob :', error?.message);
        return new Response(JSON.stringify({ error: 'BANK_SAVE_CLOUD_FAILED' }), { status: 500 });
      }
    }

    // [Point 2] FS local : écriture atomique avec rollback en cas d'échec.
    try {
      await postgresClient.createFolder(folderPath);
      await postgresClient.saveAsset(assetPath, data);
      await postgresClient.saveFile(metaPath, JSON.stringify(finalMetadata, null, 2));

      // [CONCORDANCE] Miroir dans la BDD Locale : l'actif binaire et ses
      // métadonnées sont aussi persistés dans `.local-db/bank/{nom}/` afin
      // d'assurer la concordance avec la BDD Web.
      try {
        await localDB.saveBankAsset(`${safeName}/${safeName}.${extension}`, data);
        await localDB.saveBankAsset(`${safeName}/metadata.json`, JSON.stringify(finalMetadata, null, 2));
      } catch (localErr: any) {
        console.warn('[BANK_SAVE] Miroir BDD Locale ignoré :', localErr?.message);
      }

      // [RAG_LOCAL] Vectorisation « live » de la métadonnée dans le store Chroma
      // embarqué afin que l'actif soit immédiatement retrouvable par l'étage 1
      // (vecteurs) du RAG, et pas seulement les actifs présents au seed.
      try {
        const { indexLocalDBFile } = await import('@/lib/local-indexer');
        await indexLocalDBFile(`bank/${safeName}/metadata.json`);
      } catch (idxErr: any) {
        console.warn('[BANK_SAVE] Vectorisation locale ignorée :', idxErr?.message);
      }

      return { success: true, path: folderPath };
    } catch (error: any) {
      // Rollback : on supprime l'actif et le dossier pour ne pas laisser d'orphelin.
      try {
        await postgresClient.deleteItem(assetPath);
        await postgresClient.deleteItem(folderPath);
      } catch { /* best effort */ }
      console.error('[BANK_SAVE] Échec FS :', error?.message);
      return new Response(JSON.stringify({ error: 'BANK_SAVE_FAILED' }), { status: 500 });
    }
  }
});

export const GET = createHybridRoute<unknown, any>({
  name: 'BANK_LIST',
  webHandler: async (req) => {
    // [Point 1] Authentification.
    const session = await getSessionFromCookie();
    if (!session) {
      return new Response(JSON.stringify({ error: 'NON_AUTHENTIFIÉ' }), { status: 401 });
    }

    // Pagination (offset) optionnelle : ?limit=50&offset=0
    let limit = 50;
    let offset = 0;
    try {
      const url = new URL(req.url);
      const rawLimit = Number(url.searchParams.get('limit'));
      const rawOffset = Number(url.searchParams.get('offset'));
      if (Number.isFinite(rawLimit) && rawLimit > 0) limit = Math.min(rawLimit, 200);
      if (Number.isFinite(rawOffset) && rawOffset > 0) offset = Math.floor(rawOffset);
    } catch { /* req.url indisponible : pagination par défaut */ }

    // [C3] Endpoint de lecture dédié et cohérent avec l'écriture.
    if (isCloudServerless) {
      if (!BLOB_TOKEN) return { success: true, items: [], total: 0, cloud: true };
      try {
        const { blobs } = await list({ prefix: 'bank/', token: BLOB_TOKEN });
        const metaBlobs = blobs.filter(b => b.pathname.endsWith('/metadata.json'));
        // Récupération par lots pour limiter la pression réseau (pas de fetch N séquentiels).
        const sliced = metaBlobs.slice(offset, offset + limit);
        const items = await Promise.all(
          sliced.map(async (b) => {
            try {
              const res = await fetch(b.url);
              return res.ok ? await res.json() : null;
            } catch {
              return null;
            }
          })
        );
        return {
          success: true,
          items: items.filter(Boolean),
          total: metaBlobs.length,
          limit,
          offset,
          cloud: true,
        };
      } catch (error: any) {
        console.error('[BANK_LIST] Échec Blob :', error?.message);
        return new Response(JSON.stringify({ error: 'BANK_LIST_FAILED' }), { status: 500 });
      }
    }

    const all = await postgresClient.listBankAssets();
    const items = all.slice(offset, offset + limit);
    return { success: true, items, total: all.length, limit, offset };
  }
});

export const DELETE = createHybridRoute<{ name?: string }, any>({
  name: 'BANK_DELETE',
  webHandler: async (req, body) => {
    // [Point 1] Authentification.
    const session = await getSessionFromCookie();
    if (!session) {
      return new Response(JSON.stringify({ error: 'NON_AUTHENTIFIÉ' }), { status: 401 });
    }

    // [Point 4] Nom sûr (même normalisation que la sauvegarde). Nom transmis
    // en query string (?name=) car le client DELETE n'envoie pas de corps.
    let rawName = (body?.name as string) || '';
    try {
      const { searchParams } = new URL(req.url);
      rawName = rawName || searchParams.get('name') || '';
    } catch { /* req.url indisponible */ }
    const safeName = rawName.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
    if (!safeName) {
      return new Response(JSON.stringify({ error: 'NOM_REQUIS' }), { status: 400 });
    }

    const folderPath = `bank/${safeName}`;

    // Cloud serverless : suppression des blobs (binaire + metadata) et de
    // l'index Weaviate afin que l'actif disparaisse aussi du RAG.
    if (isCloudServerless) {
      if (!BLOB_TOKEN) return new Response(JSON.stringify({ error: 'BANK_WRITE_CLOUD_UNSUPPORTED' }), { status: 400 });
      try {
        const { blobs } = await list({ prefix: `${folderPath}/`, token: BLOB_TOKEN });
        await Promise.all(blobs.map(b => del(b.url, { token: BLOB_TOKEN })));
      } catch (blobErr: any) {
        console.warn('[BANK_DELETE] Suppression Blob ignorée :', blobErr?.message);
      }
      try {
        const { deleteBankAsset } = await import('@/lib/weaviate/weaviate-bank');
        await deleteBankAsset(safeName);
      } catch (weavErr: any) {
        console.warn('[BANK_DELETE] Suppression Weaviate ignorée :', weavErr?.message);
      }
      return { success: true, message: 'ACTIF_SUPPRIME', cloud: true };
    }

    // Local / hybride : suppression du Registre, de la BDD Locale, et du
    // store Chroma (deux chemins possibles selon l'indexation : seed vs capture live).
    try {
      await postgresClient.deleteItem(folderPath);
    } catch (e: any) {
      console.warn('[BANK_DELETE] Suppression Registre ignorée :', e?.message);
    }
    try {
      await localDB.deleteItem(folderPath);
    } catch (e: any) {
      console.warn('[BANK_DELETE] Suppression BDD Locale ignorée :', e?.message);
    }
    try {
      const { deleteChromaItem } = await import('@/lib/local-indexer');
      await deleteChromaItem(`bank/${safeName}/metadata.json`);
      await deleteChromaItem(`INDEX_CHROMA/bank/${safeName}/metadata.json`);
    } catch (e: any) {
      console.warn('[BANK_DELETE] Suppression Chroma ignorée :', e?.message);
    }

    return { success: true, message: 'ACTIF_SUPPRIME' };
  }
});
