export const dynamic = 'force-dynamic';
export const revalidate = false;

import { createHybridRoute } from '@/lib/api-route-creator';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * API Route pour la Banque d'Images.
 * Sauvegarde l'actif binaire et ses métadonnées de manière atomique.
 */
export const POST = createHybridRoute<{ 
  name: string; 
  type: 'image' | 'video'; 
  data: string; 
  metadata: any 
}, any>({
  name: 'BANK_SAVE',
  webHandler: async (req, body) => {
    const { name, type, data, metadata } = body;
    
    if (!name || !data) {
      return new Response(JSON.stringify({ error: "DONNEES_MANQUANTES" }), { status: 400 });
    }

    const safeName = name.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '_');
    const folderPath = `bank/${safeName}`;
    const extension = type === 'image' ? 'jpg' : 'mp4';
    const assetPath = `${folderPath}/${safeName}.${extension}`;
    const metaPath = `${folderPath}/metadata.json`;

    try {
      // 1. Créer le dossier
      await postgresClient.createFolder(folderPath);
      
      // 2. Sauvegarder l'actif binaire
      await postgresClient.saveAsset(assetPath, data);
      
      // 3. Sauvegarder les métadonnées
      await postgresClient.saveFile(metaPath, JSON.stringify({
        ...metadata,
        name: safeName,
        type: type,
        path: assetPath,
        created_at: new Date().toISOString()
      }, null, 2));

      return { success: true, path: folderPath };
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
});
