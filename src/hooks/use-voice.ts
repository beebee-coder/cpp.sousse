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
 * Hook de reconnaissance vocale stable pour environnement industriel.
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
    };

    recognition.onresult = (event: any) => {
      const lastIndex = event.resultIndex;
      const result = event.results[lastIndex];
      
      if (result.isFinal) {
        const segment = result[0].transcript;
        if (segment && segment.trim() && optionsRef.current.onResult) {
          optionsRef.current.onResult(segment.trim());
        }
      }
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
      if (optionsRef.current.autoRestart && !isManuallyStopped.current) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === 'no-speech') return;

      // Utilisation de warn au lieu de error pour les permissions afin d'éviter l'overlay Next.js
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        console.warn(`[VOICE_HOOK] ⚠️ Permission microphone refusée ou indisponible.`);
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
      } catch (e) {}
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
