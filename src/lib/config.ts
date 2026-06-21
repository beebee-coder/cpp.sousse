// ✅ Développement : lib/config.ts
import { isDesktop } from './platform';

export const config = {
    // Valeurs par défaut si .env est absent
    aiApiUrl: process.env.AI_API_URL || 'https://api.groq.com/v1',
    aiModel: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    isDesktop: isDesktop,
    apiMode: isDesktop ? 'desktop' : 'web',
  };