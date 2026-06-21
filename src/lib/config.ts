
/**
 * @fileOverview Configuration centralisée et sécurisée pour VisioNode.
 * Gère l'accès aux variables d'environnement de manière hybride (Browser/Node).
 */
import { isDesktop } from './platform';

const getEnv = (key: string, fallback: string): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || fallback;
  }
  return fallback;
};

export const config = {
  aiApiUrl: getEnv('AI_API_URL', 'https://api.groq.com/v1'),
  aiModel: getEnv('AI_MODEL', 'llama-3.3-70b-versatile'),
  isDesktop: isDesktop,
  apiMode: isDesktop ? 'desktop' : 'web',
  repoUrl: 'https://github.com/beebee-coder/cpp.sousse.git'
};
