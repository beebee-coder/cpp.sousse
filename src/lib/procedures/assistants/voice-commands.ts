/**
 * @fileOverview Dictionnaire de commandes vocales pour les procédures industrielles.
 */

export interface VoiceAction {
  action: 'START' | 'NEXT' | 'BACK' | 'ALARM' | 'STATUS' | 'HELP' | 'CONFIRM';
  keywords: string[];
  description: string;
}

export const PROCEDURE_VOICE_COMMANDS: VoiceAction[] = [
  { action: 'START', keywords: ['démarrer', 'initialiser', 'commencer', 'start'], description: 'Lance la procédure' },
  { action: 'CONFIRM', keywords: ['confirmer', 'confirmé', 'ok', 'validé', 'confirm'], description: 'Confirme le prérequis ou l\'étape en cours' },
  { action: 'NEXT', keywords: ['suivant', 'étape suivante', 'next'], description: 'Passe à l\'étape suivante' },
  { action: 'BACK', keywords: ['précédent', 'retour', 'back'], description: 'Revient à l\'étape précédente' },
  { action: 'ALARM', keywords: ['alerte', 'alarme', 'problème', 'danger', 'stop', 'erreur'], description: 'Déclenche une alerte' },
  { action: 'STATUS', keywords: ['statut', 'progression', 'où en sommes nous'], description: 'Donne le statut actuel' },
  { action: 'HELP', keywords: ['aide', 'conseil', 'comment faire'], description: 'Demande l\'aide de l\'assistant' },
];

/**
 * Identifie une action à partir d'un texte transcrit.
 */
export function matchVoiceAction(transcript: string): VoiceAction | null {
  const normalized = transcript.toLowerCase();
  for (const cmd of PROCEDURE_VOICE_COMMANDS) {
    if (cmd.keywords.some(k => normalized.includes(k))) {
      return cmd;
    }
  }
  return null;
}
