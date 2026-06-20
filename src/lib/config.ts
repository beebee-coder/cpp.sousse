// ✅ Développement : lib/config.ts
export const config = {
    // Valeurs par défaut si .env est absent
    aiApiUrl: process.env.AI_API_URL || 'https://api.groq.com/v1',
    aiModel: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    // L'utilisateur n'a rien à configurer
  };