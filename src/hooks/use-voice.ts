
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onInterimResult?: (text: string) => void;
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
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
    isSupported: false,
    error: null,
    transcript: ''
  });

  // Utilisation de refs pour éviter les closures obsolètes dans l'API Speech
  const onResultRef = useRef(options.onResult);
  const onEndRef = useRef(options.onEnd);
  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);

  useEffect(() => {
    onResultRef.current = options.onResult;
    onEndRef.current = options.onEnd;
  }, [options.onResult, options.onEnd]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false, error: 'Non supporté' }));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = options.continuous ?? true;
      recognition.interimResults = options.interimResults ?? false;
      recognition.lang = options.lang || 'fr-FR';

      recognition.onresult = (event: any) => {
        let finalSegment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          }
        }

        if (finalSegment.trim()) {
          const cleanText = finalSegment.trim();
          console.log(`[VOICE_HOOK] 🎙️ Texte final détecté : "${cleanText}"`);
          if (onResultRef.current) {
            onResultRef.current(cleanText);
          }
          setState(prev => ({ ...prev, transcript: cleanText }));
        }
      };

      recognition.onstart = () => {
        console.log('[VOICE_HOOK] 🟢 Moteur actif');
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onend = () => {
        console.log('[VOICE_HOOK] 🔴 Moteur en veille');
        setState(prev => ({ ...prev, isListening: false }));
        if (onEndRef.current) onEndRef.current();

        if (options.autoRestart && !isManuallyStopped.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error(`[VOICE_HOOK] ❌ Erreur : ${event.error}`);
          setState(prev => ({ ...prev, error: event.error }));
        }
      };

      recognitionRef.current = recognition;
      setState(prev => ({ ...prev, isSupported: true }));

    } catch (error) {
      console.error('[VOICE_HOOK] ❌ Initialisation échouée');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [options.lang, options.continuous, options.interimResults, options.autoRestart]);

  const startListening = useCallback(() => {
    isManuallyStopped.current = false;
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn('[VOICE_HOOK] Déjà actif ou erreur matériel');
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
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { ...state, startListening, stopListening, speak };
}
