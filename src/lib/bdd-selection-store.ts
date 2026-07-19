'use client';

import { useSyncExternalStore } from 'react';

/**
 * @fileOverview Partage léger de la sélection courante de l'Explorateur BDD
 * (chemin relatif + type) vers le panneau de synchronisation de la barre
 * latérale, afin d'y exposer un bouton « Vectoriser la sélection ».
 *
 * Volontairement minimaliste (pas de dépendance de state management) :
 * un petit store externe piloté par `useSyncExternalStore`.
 */

interface BddSelection {
  relPath: string | null;
  type: 'file' | 'folder' | 'collection' | null;
}

let selection: BddSelection = { relPath: null, type: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setBddSelection(sel: BddSelection) {
  if (selection.relPath === sel.relPath && selection.type === sel.type) return;
  selection = sel;
  emit();
}

export function clearBddSelection() {
  setBddSelection({ relPath: null, type: null });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): BddSelection {
  return selection;
}

export function useBddSelection(): BddSelection {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
