
/**
 * @fileOverview Point d'entrée AI pour l'environnement de développement.
 * Les flux sont chargés dynamiquement pour éviter les erreurs système au démarrage.
 */

// Suppression de l'import 'dotenv' manuel pour éviter les erreurs 'os' côté client
// Next.js gère nativement le chargement du fichier .env

import '@/ai/flows/vision-assistant-description.ts';
import '@/ai/flows/visual-document-retrieval.ts';
import '@/ai/flows/dynamic-chat-flow.ts';
