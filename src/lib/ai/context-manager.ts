import { GroqMessage } from './groq-provider';
import { ragOrchestrator, type RAGResult } from './rag-orchestrator';
import { ragHub } from './rag/hub';
import { createRagTrace } from './rag/trace';
import { getSystemContextSummary } from '@/lib/chroma';

export interface ChatContext {
  mode: 'web' | 'hybride' | 'locale';
  userName?: string;
  systemState: {
    mode: string;
    ragDocuments: number;
    bankAssets: number;
    localDBFiles: number;
  };
  ragResults: RAGResult[];
  context: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export class ContextManager {
  getConfidenceLabel(results: RAGResult[]): 'high' | 'medium' | 'low' | 'none' {
    const filtered = results.filter(r => (r.score || 0) >= 0.2);
    if (filtered.length === 0) return 'none';
    const topScore = filtered[0]?.score || 0;
    const qaCount = filtered.filter(r => r.metadata?.knowledgeType === 'qa').length;
    // Les actifs Bank (image/vidéo) pertinents conférent aussi une
    // confiance élevée : l'IA a trouvé le visuel lié à la requête.
    const bankCount = filtered.filter(r => r.metadata?.knowledgeType === 'bank').length;
    if (topScore >= 0.45 && (qaCount > 0 || bankCount > 0)) return 'high';
    if (topScore >= 0.25 && (qaCount > 0 || bankCount > 0)) return 'medium';
    if (topScore > 0.2) return 'low';
    return 'none';
  }

  async buildContext(
    query: string,
    history: import('@/lib/chat-storage/types').ChatMessage[],
    mode: 'web' | 'hybride' | 'locale',
    userName?: string
  ): Promise<ChatContext> {
    const trace = createRagTrace(query, mode);
    const systemState = await getSystemContextSummary();

    const hubStart = Date.now();
    let ragResults: RAGResult[] = [];
    let hubError: string | undefined;
    try {
      // Recherche factorisée multi-connexions (RAGHub fan-out sur procedures/knowledge/bank).
      ragResults = await ragHub.search(query, history as any[], { trace });
    } catch (e: any) {
      hubError = e?.message || String(e);
    }
    trace.stage('hub', 'RAGHub (fan-out connexions)', {
      count: ragResults.length,
      topScore: ragResults.length ? Math.max(...ragResults.map((r) => r.score || 0)) : null,
      ms: Date.now() - hubStart,
      error: hubError,
      reason: hubError ? 'fan-out global en échec' : undefined,
    });

    // État système : reflète la disponibilité des sources (diagnostic de non-accès).
    trace.stage('system', `État sources (docs=${systemState.ragDocuments}, bank=${systemState.bankAssets}, localDB=${systemState.localDBFiles})`, {
      count: systemState.ragDocuments || 0,
      topScore: null,
      ms: 0,
      skipped: !systemState.ragDocuments && !systemState.bankAssets && !systemState.localDBFiles,
      reason:
        systemState.ragDocuments || systemState.bankAssets || systemState.localDBFiles
          ? undefined
          : 'aucune source indexée (seed/indexation manquant)',
    });

    // Formatage/presentation délégué à l'orchestrateur historique (inchangé).
    const context = ragOrchestrator.formatContext(ragResults);
    const sources = ragOrchestrator.getSources(ragResults);
    const confidence = this.getConfidenceLabel(ragResults);

    trace.stage('format', 'Formatage contexte', {
      count: context === 'AUCUN_CONTEXTE' ? 0 : ragResults.length,
      topScore: null,
      ms: 0,
      reason: context === 'AUCUN_CONTEXTE' ? 'AUCUN_CONTEXTE (score < 0.2 partout)' : undefined,
    });

    // Unique log consolidé (jamais en boucle) — diagnostic de non-accès IA.
    trace.flush(ragResults.length, confidence);

    return {
      mode,
      userName,
      systemState: {
        mode: systemState.mode,
        ragDocuments: systemState.ragDocuments || 0,
        bankAssets: systemState.bankAssets || 0,
        localDBFiles: systemState.localDBFiles || 0,
      },
      ragResults,
      context,
      sources,
      confidence,
    };
  }

  buildSystemPrompt(context: ChatContext): string {
    const confidence = contextManager.getConfidenceLabel(context.ragResults);
    const qaCount = context.ragResults.filter(r => r.metadata?.knowledgeType === 'qa').length;
    const userName = context.userName;

    const greeting = userName ? `Vous parlez à ${userName}. ` : '';
    const basePrompt = `Vous êtes COPILOTE-CCPE, le copilote de contrôle industriel. ${greeting}Répondez en français de manière concise et technique, À L'UTILISATEUR FINAL (opérateur/technicien), jamais au développeur de l'application.
RÈGLES STRICTES:
1. UTILISEZ EN PRIORITÉ les réponses Q/R du contexte — ce sont des réponses directes validées.
2. RÉFORMULEZ toujours le contenu du contexte en une réponse naturelle et lisible pour l'utilisateur. N'utilisez JAMAIS les marqueurs internes du contexte (ex: [Q/R ...], [SOURCE:...], [WEB_REGISTRY], [VEC_CHROMA], préfixes « Q: » / « R: »). Ne recopiez pas le chunk brut : extravez la valeur technique (chiffres, niveaux, procédures) et présentez-la proprement.
3. Ne pas inventer d'information. Si le contexte ne contient pas la réponse, dites-le clairement.
4. Ne jamais inclure de balises XML, HTML ou <environment_details>. Réponse en texte brut uniquement.
5. Si AUCUN_CONTEXTE ou CONFIANCE RAG: low/none, répondez que l'information n'est pas disponible dans la base de connaissances.
6. CAS BANQUE MÉDIAS : si un actif Bank (image/vidéo) est pertinent pour la question de l'utilisateur, répondez DU POINT DE VUE UTILISATEUR : citez le nom, le type (image/vidéo) et la description de l'actif, puis PROPOSEZ explicitement à l'utilisateur d'afficher le visuel (« Vous pouvez afficher l'image/vidéo ci-dessous » — l'aperçu s'affiche automatiquement). N'écrivez JAMAIS de phrase du type « cela concerne le développeur / l'application » : l'utilisateur veut l'information contenue dans les métadonnées du fichier, pas une analyse de l'architecture.`;

    const confidenceLine = `\nCONFIANCE RAG: ${confidence}.`;

    // Banque médias : lorsqu'un actif Bank (image/vidéo) est pertinent, l'IA
    // doit le présenter à l'utilisateur et proposer l'affichage (l'UI
    // l'affiche automatiquement via la dérivation media dans chat-router).
    const bankAssets = context.ragResults.filter(
      r => r.metadata?.knowledgeType === 'bank'
    );
    const bankLine = bankAssets.length > 0
      ? `\nBANQUE MÉDIAS (${bankAssets.length} actif(s)) : ${bankAssets
          .map((a) => {
            const m = (a.metadata || {}) as any;
            const type = m.type === 'video' ? 'vidéo' : (m.type === 'image' ? 'image' : (m.mediaType === 'video' ? 'vidéo' : 'image'));
            return `${m.title || m.name || a.id} (${type})${m.description ? ` — ${m.description}` : ''}`;
          })
          .join(' ; ')}. Règle : présentez ces actifs à l'utilisateur (nom/type/description) et proposez l'affichage du visuel.`
      : '';

    const ragSection = context.context !== 'AUCUN_CONTEXTE'
      ? `\nCONTEXTE RÉCUPÉRÉ:\n${context.context}`
      : '\nCONTEXTE RÉCUPÉRÉ: Aucun résultat. Informez l\'utilisateur que la knowledge base ne contient pas cette information.';

    const stateSection = `\nÉTAT SYSTÈME: Mode=${context.mode}.`;

    return `${basePrompt}${confidenceLine}${bankLine}${ragSection}${stateSection}`;
  }

  buildMessages(
    context: ChatContext,
    history: import('@/lib/chat-storage/types').ChatMessage[],
    userMessage: string,
    userName?: string
  ): GroqMessage[] {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (userName && history.length === 0) {
      messages.push({ role: 'user', content: `Bonjour, je suis ${userName}.` });
    }

    for (const m of history.slice(-6)) {
      messages.push({
        role: m.role === 'model' ? 'assistant' as const : 'user' as const,
        content: m.content,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    return messages;
  }
}

export const contextManager = new ContextManager();
