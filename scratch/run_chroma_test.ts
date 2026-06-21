import * as dotenv from 'dotenv';
import path from 'path';

// Charge les variables d'environnement depuis le fichier .env à la racine
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { runChromaDemo } from '../src/lib/chroma-example';

async function main() {
  console.log("Starting ChromaDB test script...");
  try {
    const results = await runChromaDemo();
    console.log("Success! Test results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

main();
