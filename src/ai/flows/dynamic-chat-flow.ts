/**
 * @fileOverview Flux de chat exclusif Groq pour VisioNode.
 * Performance : Llama 3.3 (Vitesse LPU). Genkit inhibé.
 * Audit : Logs iconographiés structurés en français industriel.
 */

import Groq from 'groq-sdk';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

type ChatInput = {
  history: ChatMessage[];
  message: string;
};

type ChatOutput = {
  text: string;
  provider: string;
};

/**
 * Action de chat avec priorité exclusive Groq et audit complet.
 */
export async function dynamicChat(input: ChatInput): Promise<ChatOutput> {
  const timestamp = new Date().toLocaleTimeString();
  
  if (!process.env.GROQ_API_KEY) {
    console.error(`❌ [${timestamp}] [ERREUR_CRITIQUE] Clé GROQ_API_KEY manquante.`);
    throw new Error("ERREUR_LIAISON_GROQ : Clé API non configurée.");
  }

  console.log(`⚡ [${timestamp}] [NODE_GROQ] Engagement Llama 3.3 (Vitesse LPU)...`);

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { 
        role: 'system', 
        content: 'Vous êtes VisioNode Core, l\'IA de contrôle industriel CCP. Réponses techniques, précises et exclusivement en français. Vous utilisez actuellement le moteur Groq LPU.' 
      },
      ...input.history.map((m): Groq.Chat.ChatCompletionMessageParam => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: input.message }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content;
    if (text) {
      console.log(`✅ [${timestamp}] [SUCCÈS] Flux généré par le nœud Groq.`);
      return { text, provider: 'GROQ/LLAMA-3.3' };
    }
  } catch (err: any) {
    console.error(`❌ [${timestamp}] [ERREUR_LIAISON] Échec du nœud Groq :`, err.message);
    throw new Error(`ERREUR_LIAISON_GROQ : ${err.message}`);
  }

  throw new Error("ERREUR_FLUX : Réponse vide.");
}
