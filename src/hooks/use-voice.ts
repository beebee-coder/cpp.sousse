'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  lang?: string;
  continuous?: boolean;
  autoRestart?: boolean;
}

interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  transcript: string;
}

export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
    transcript: ''
  });

  const onResultRef = useRef(options.onResult);
  const optionsRef = useRef(options);
  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);

  // Mise à jour des références sans redéclencher les hooks
  useEffect(() => {
    onResultRef.current = options.onResult;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = optionsRef.current.lang || 'fr-FR';

      recognition.onresult = (event: any) => {
        let segment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            segment += event.results[i][0].transcript;
          }
        }

        if (segment.trim()) {
          console.log(`[VOICE_HOOK] 🎙️ Texte détecté: "${segment.trim()}"`);
          onResultRef.current?.(segment.trim());
        }
      };

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
        // Redémarrage automatique si nécessaire
        if (optionsRef.current.autoRestart && !isManuallyStopped.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error(`[VOICE_HOOK] ❌ Erreur : ${event.error}`);
          setState(prev => ({ ...prev, error: event.error, isListening: false }));
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[VOICE_HOOK] Initialisation échouée', e);
    }

    // Nettoyage impératif pour éviter la violation "unload"
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const startListening = useCallback(() => {
    isManuallyStopped.current = false;
    try {
      recognitionRef.current?.start();
    } catch (e) {}
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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }, []);

  return { ...state, startListening, stopListening, speak };
}
