/**
 * @fileOverview Scoring lexical FR partagé pour le repli offline des connexions RAG.
 *
 * Anciennement dupliqué dans rag-orchestrator.ts (scoreItemAgainstQuery), il
 * est désormais factorisé ici pour que TOUTE connexion lexicale (procédures,
 * connaissances, bank, et features futures) réutilise le MEME tokeniseur canonique
 * (tokenizeWithStems) et la même pondération. Garantit des scores cohérents
 * entre les modes web / hybride / local, et entre toutes les fonctionnalités.
 */

import { tokenizeWithStems } from '../tokenizer';

export interface LexicalScorable {
  id: string;
  type?: string;
  title?: string;
  question?: string | null;
  answer?: string | null;
  tags?: string[];
  category?: string | null;
  content?: string;
  origin: string;
}

export interface LexicalHit {
  id: string;
  document: string;
  score: number;
  knowledgeType: 'qa' | 'procedure' | 'document' | 'bank';
}

/**
 * Score un item contre les tokens de la requête (stemming FR).
 * Renvoie null si le seuil de correspondance minimal n'est pas atteint.
 */
export function scoreItemAgainstQuery(
  item: LexicalScorable,
  queryTokens: string[],
): LexicalHit | null {
  const title = (item.title || '').toLowerCase();
  const question = (item.question || '').toLowerCase();
  const answer = (item.answer || '').toLowerCase();
  const tags = (item.tags || []).join(' ').toLowerCase();
  const content = (item.content || '').toLowerCase();

  let score = 0;
  let matchCount = 0;
  const requiredTokenCount = Math.max(1, Math.ceil(queryTokens.length * 0.4));

  for (const token of queryTokens) {
    const tokenRegex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const titleHits = (title.match(tokenRegex) || []).length;
    const tagsHits = (tags.match(tokenRegex) || []).length;
    const questionHits = (question.match(tokenRegex) || []).length;
    const answerHits = (answer.match(tokenRegex) || []).length;
    const contentHits = (content.match(tokenRegex) || []).length;

    if (titleHits > 0) { score += 35 * titleHits; matchCount++; }
    if (tagsHits > 0) { score += 22 * tagsHits; matchCount++; }
    if (questionHits > 0) { score += 18 * questionHits; matchCount++; }
    if (answerHits > 0) { score += 10 * answerHits; }
    if (contentHits > 0) { score += 4 * contentHits; }
  }

  if (matchCount < requiredTokenCount || score <= 0) return null;

  const knowledgeType =
    item.tags?.includes?.('qa') || (item.question && item.answer)
      ? 'qa'
      : (item.question || item.answer ? 'qa' : (item.content ? 'document' : 'document'));

  const document =
    item.question && item.answer
      ? `Q: ${item.question}\nR: ${item.answer}`
      : (item.content || item.title || '');

  return { id: item.id, document, score: Math.min(score / 100, 0.98), knowledgeType };
}

/** Tokenise une requête (avec historique optionnel) via le tokeniseur canonique FR. */
export function tokenizeQuery(query: string, history: string[] = []): string[] {
  const effective = [...history.slice(-4), query].filter(Boolean).join(' ');
  return tokenizeWithStems(effective);
}
