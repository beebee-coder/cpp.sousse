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
 * Hook de reconnaissance vocale ultra-stable.
 * Utilise des références pour les callbacks afin d'éviter les ruptures de liaison 
 * pendant les cycles de rendu de React.
 */
export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
  });

  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);
  
  // Utilisation de Refs pour les options pour éviter de redéclencher useEffect inutilement
  const optionsRef = useRef(options);
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
    recognition.interimResults = false;
    recognition.lang = optionsRef.current.lang || 'fr-FR';

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }));
      console.log('[VOICE_HOOK] 🎙️ Session démarrée');
    };

    recognition.onresult = (event: any) => {
      const lastIndex = event.resultIndex;
      const segment = event.results[lastIndex][0].transcript;
      
      if (segment.trim()) {
        console.log(`[VOICE_HOOK] 🗣️ Texte capturé: "${segment.trim()}"`);
        if (optionsRef.current.onResult) {
          optionsRef.current.onResult(segment.trim());
        }
      }
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
      if (optionsRef.current.autoRestart && !isManuallyStopped.current) {
        try {
          recognition.start();
        } catch (e) {
          // Erreur ignorée (déjà démarré)
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error(`[VOICE_HOOK] ❌ Erreur : ${event.error}`);
      setState(prev => ({ ...prev, error: event.error, isListening: false }));
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
        console.warn('[VOICE_HOOK] Micro déjà actif');
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
