/**
 * @fileOverview Tokeniseur FR canonique partagé (C1 — unication JS/Rust).
 *
 * Ce module est la SOURCE UNIQUE de vérité pour la tokenisation côté JS. Il
 * reproduit exactement la spécification du tokeniseur Rust
 * (`src-tauri/src/vector_store/embedding.rs::tokenize_with_stems`) afin que le
 * RAG produise des scores de pertinence identiques entre les modes web,
 * hybride et locale. Ne pas dupliquer cette logique ailleurs.
 */

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'ce', 'ces',
  'pour', 'sur', 'dans', 'avec', 'est', 'sont',
]);

/** Supprime les accents via décomposition NFD (identique au Rust `.nfd().filter(!combining)`). */
function stripAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Racinalisation FR simpliste, miroir de `simple_stem` en Rust. */
function simpleStem(word: string): string {
  const chars = Array.from(word);
  const n = chars.length;
  if (n <= 3) return word;

  const trim = (drop: number) => chars.slice(0, n - drop).join('');

  if (word.endsWith('eurs') || word.endsWith('euse')) return trim(3);
  if (word.endsWith('aux')) return trim(2);
  if (word.endsWith('eur')) return trim(3);
  if (word.endsWith('eux') || word.endsWith('ies') || word.endsWith('ées')) return trim(2);
  if (word.endsWith('ment') && n > 5) return trim(4);
  if (word.endsWith('tion') || word.endsWith('sion')) return trim(3);
  if (word.endsWith('ent') || word.endsWith('ant')) return trim(3);
  if (word.endsWith('ées') || word.endsWith('és') || word.endsWith('ée') || word.endsWith('é')) return trim(1);
  if (word.endsWith('s') || word.endsWith('x')) return trim(1);

  return word;
}

/**
 * Tokenise un texte : minuscules, accents supprimés, alphanumérique seulement,
 * mots > 2 caractères hors stop-words, puis stemming FR. Identique au Rust.
 */
export function tokenizeWithStems(text: string): string[] {
  if (!text) return [];
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(simpleStem);
}

/**
 * Variante sans stemming (équivalent Rust `tokenize`). Conservée pour les
 * appels qui ne veulent pas de radicalisation (ex. correspondances exactes).
 */
export function tokenizeFr(text: string): string[] {
  if (!text) return [];
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export const TOKENIZER_STOP_WORDS = STOP_WORDS;
