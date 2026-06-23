'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  lang?: string;
  autoRestart?: boolean;
}

interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
}

/**
 * Hook de reconnaissance vocale ultra-stable pour environnement industriel.
 * Utilise des références immuables pour garantir l'ordre des hooks et la persistance des rappels.
 */
export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
  });

  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);
  const optionsRef = useRef(options);

  // Mise à jour de la référence des options sans déclencher de re-rendu
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = optionsRef.current.lang || 'fr-FR';

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }));
      console.log('[VOICE_HOOK] 🎙️ Session active.');
    };

    recognition.onresult = (event: any) => {
      const lastIndex = event.resultIndex;
      const result = event.results[lastIndex];
      
      // On ne traite que les segments finaux pour garantir une injection propre dans les champs
      if (result.isFinal) {
        const segment = result[0].transcript;
        if (segment && segment.trim()) {
          console.log(`[VOICE_HOOK] ✅ Texte validé : "${segment.trim()}"`);
          if (optionsRef.current.onResult) {
            optionsRef.current.onResult(segment.trim());
          }
        }
      }
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
      if (optionsRef.current.autoRestart && !isManuallyStopped.current) {
        try {
          recognition.start();
        } catch (e) {
          // Échec de redémarrage ignoré
        }
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === 'no-speech') return;

      // On utilise warn au lieu de error pour 'not-allowed' pour éviter de bloquer l'UI de dev
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        console.warn(`[VOICE_HOOK] ⚠️ Permission microphone refusée ou indisponible (SSL requis pour Speech API).`);
      } else {
        console.error(`[VOICE_HOOK] ❌ Erreur système : ${err}`);
      }
      
      setState(prev => ({ ...prev, error: err, isListening: false }));
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const startListening = useCallback(() => {
    isManuallyStopped.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('[VOICE_HOOK] Microphone indisponible ou déjà actif.');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }, []);

  return { ...state, startListening, stopListening, speak };
}
