/**
 * @fileOverview Couche de connexion RAG factorisée (RAGConnection).
 *
 * Chaque fonctionnalité (procédures, connaissances, banque, et toute feature
 * future) s'enregistre via UNE seule instance RAGConnection qui déclare :
 *   - comment indexer / désindexer ses documents (index / remove),
 *   - comment les rechercher (search renvoie des RAGResult normalisés).
 *
 * Le RAGHub (hub.ts) fait ensuite un fan-out sur toutes les connexions
 * enregistrées, puis une déduplication + un ranking centrés. Ajouter une
 * fonctionnalité = 1 fichier connections/feature.ts + 1 register(),
 * SANS modifier le pipeline de recherche.
 */

import type { RAGResult, RAGOptions } from '../rag-orchestrator';

/** Document d'indexation normalisé, indépendant de la source vectorielle. */
export interface RAGDoc {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export type RAGConnectionMode = 'vector' | 'lexical' | 'cloud';

export interface RAGConnection {
  /** Identifiant stable de la connexion (ex: 'procedures', 'knowledge', 'bank'). */
  id: string;
  /** Libellé humain pour le diagnostic. */
  label: string;
  /** Mode principal utilisé pour le classement / la stratégie de repli. */
  mode: RAGConnectionMode;
  /** Indexe un document (idempotent). Optionnel si la connexion est read-only. */
  index?: (doc: RAGDoc) => Promise<void>;
  /** Désindexe un document par id. Optionnel. */
  remove?: (id: string) => Promise<void>;
  /** Recherche sémantique/lexicale → RAGResult normalisés. Jamais throw. */
  search: (query: string, options: RAGOptions) => Promise<RAGResult[]>;
}

const connections = new Map<string, RAGConnection>();

export const ragConnections = {
  register(conn: RAGConnection): void {
    if (connections.has(conn.id)) {
      console.warn(`[RAG_CONN] Connexion déjà enregistrée, écrasement : ${conn.id}`);
    }
    connections.set(conn.id, conn);
  },

  unregister(id: string): void {
    connections.delete(id);
  },

  get(id: string): RAGConnection | undefined {
    return connections.get(id);
  },

  all(): RAGConnection[] {
    return Array.from(connections.values());
  },

  has(id: string): boolean {
    return connections.has(id);
  },

  clear(): void {
    connections.clear();
  },
};
