import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Global Genkit instance configured with Google AI.
 * The plugin automatically looks for GOOGLE_GENAI_API_KEY in the environment.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: 'googleai/gemini-1.5-flash', // ✅ Modèle stable
});