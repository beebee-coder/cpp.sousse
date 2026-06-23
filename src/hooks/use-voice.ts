'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoRestart?: boolean;
}

interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  error: 'not-allowed' | 'no-speech' | 'network' | 'aborted' | string | null;
  transcript: string;
}

/**
 * Hook de reconnaissance vocale ultra-stable.
 * Utilise des références pour éviter les cycles de re-rendu et les erreurs d'ordre de hooks.
 */
export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
    transcript: ''
  });

  // Utilisation de Refs pour les options pour éviter de dépendre d'elles dans les effets
  const onResultRef = useRef(options.onResult);
  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);
  const optionsRef = useRef(options);

  // Mise à jour des références à chaque rendu
  useEffect(() => {
    onResultRef.current = options.onResult;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false, error: 'Navigateur non compatible' }));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = optionsRef.current.continuous ?? true;
      recognition.interimResults = optionsRef.current.interimResults ?? true;
      recognition.lang = optionsRef.current.lang || 'fr-FR';

      recognition.onresult = (event: any) => {
        let finalSegment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          }
        }

        if (finalSegment.trim()) {
          const cleanText = finalSegment.trim();
          console.log(`[VOICE_HOOK] 🎙️ Capture: "${cleanText}"`);
          if (onResultRef.current) {
            onResultRef.current(cleanText);
          }
          setState(prev => ({ ...prev, transcript: cleanText }));
        }
      };

      recognition.onstart = () => {
        console.log(`[VOICE_HOOK] 🟢 Micro Actif`);
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onend = () => {
        console.log(`[VOICE_HOOK] 🔴 Micro Inactif`);
        setState(prev => ({ ...prev, isListening: false }));
        
        if (optionsRef.current.autoRestart && !isManuallyStopped.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.onerror = (event: any) => {
        const err = event.error;
        if (err !== 'no-speech') {
          console.error(`[VOICE_HOOK] ❌ Erreur : ${err}`);
          setState(prev => ({ ...prev, error: err, isListening: false }));
        }
      };

      recognitionRef.current = recognition;
    } catch (error) {
      console.error('[VOICE_HOOK] Initialisation échouée');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []); // Exécuté une seule fois pour garantir la stabilité des hooks

  const startListening = useCallback(() => {
    isManuallyStopped.current = false;
    setState(prev => ({ ...prev, error: null }));
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn('[VOICE_HOOK] Impossible de démarrer');
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStopped.current = true;
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (!text?.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }, []);

  return { ...state, startListening, stopListening, speak };
}
