/**
 * Démonstration complète ChromaDB + Embeddings locaux
 *
 * Modèle : Xenova/all-MiniLM-L6-v2 (384 dimensions)
 * ✅ 100% local, aucune API key requise
 * ✅ Premier appel : télécharge le modèle (~25 MB) une seule fois
 */
import {
  addDocuments,
  semanticSearch,
  getOrCreateCollection,
  deleteCollection,
  getLocalEmbedder,
  type DocumentToAdd,
} from './chroma';

const SAMPLE_DOCUMENTS: DocumentToAdd[] = [
  {
    id: 'doc-1',
    content: 'Le chat dort paisiblement sur le canapé chaud au coin du feu.',
    metadata: { category: 'animal', language: 'fr' },
  },
  {
    id: 'doc-2',
    content: 'Les voitures électriques comme la Tesla réduisent les émissions de CO2.',
    metadata: { category: 'automobile', language: 'fr' },
  },
  {
    id: 'doc-3',
    content: 'Le chien de berger court joyeusement dans le grand parc verdoyant.',
    metadata: { category: 'animal', language: 'fr' },
  },
  {
    id: 'doc-4',
    content: "La nouvelle batterie lithium-ion améliore l'autonomie des véhicules électriques.",
    metadata: { category: 'automobile', language: 'fr' },
  },
  {
    id: 'doc-5',
    content: 'Les dauphins communiquent entre eux grâce à des ultrasons complexes.',
    metadata: { category: 'animal', language: 'fr' },
  },
  {
    id: 'doc-6',
    content: 'Le moteur thermique est progressivement remplacé par le moteur électrique.',
    metadata: { category: 'automobile', language: 'fr' },
  },
];

const COLLECTION_NAME = 'demo_semantique';

export async function runChromaDemo() {
  const embedder = getLocalEmbedder();

  console.log('══════════════════════════════════════════════════════════');
  console.log('  🚀 ChromaDB + Embeddings locaux (all-MiniLM-L6-v2)');
  console.log('══════════════════════════════════════════════════════════\n');

  // ÉTAPE 1 — Réinitialiser la collection
  console.log('📁 ÉTAPE 1 : Préparation de la collection...');
  try {
    await deleteCollection(COLLECTION_NAME);
    console.log(`   🗑️  Collection "${COLLECTION_NAME}" supprimée.\n`);
  } catch {
    console.log(`   ℹ️  Création de la collection "${COLLECTION_NAME}".\n`);
  }
  await getOrCreateCollection(COLLECTION_NAME, embedder);
  console.log(`   ✅ Collection prête.\n`);

  // ÉTAPE 2 — Vectoriser et stocker
  console.log(`📥 ÉTAPE 2 : Vectorisation de ${SAMPLE_DOCUMENTS.length} documents...`);
  console.log('   ⏳ (Chargement du modèle au premier appel...)\n');
  await addDocuments(COLLECTION_NAME, SAMPLE_DOCUMENTS, embedder);
  console.log(`   ✅ ${SAMPLE_DOCUMENTS.length} documents vectorisés et stockés.\n`);

  // ÉTAPE 3 — Recherche générale
  const query1 = 'Quels animaux a-t-on observés ?';
  console.log(`🔍 ÉTAPE 3 : Recherche → "${query1}"`);
  const results1 = await semanticSearch(
    { collectionName: COLLECTION_NAME, query: query1, nResults: 3 },
    embedder
  );
  results1.forEach((r, i) => {
    console.log(`   ${i + 1}. [score: ${r.score}] ${r.document}`);
  });
  console.log('');

  // ÉTAPE 4 — Recherche filtrée
  const query2 = 'Véhicules et énergie propre';
  console.log(`🔍 ÉTAPE 4 : Recherche filtrée (category=automobile) → "${query2}"`);
  const results2 = await semanticSearch(
    { collectionName: COLLECTION_NAME, query: query2, nResults: 2, whereFilter: { category: 'automobile' } },
    embedder
  );
  results2.forEach((r, i) => {
    console.log(`   ${i + 1}. [score: ${r.score}] ${r.document}`);
  });
  console.log('');

  console.log('══════════════════════════════════════════════════════════');
  console.log('  ✅ Démonstration terminée !');
  console.log('══════════════════════════════════════════════════════════\n');

  return {
    embedder: 'local/Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    queryAnimaux: { query: query1, results: results1 },
    queryAutomobile: { query: query2, results: results2 },
  };
}
