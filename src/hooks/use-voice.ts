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
  maxRetries?: number;
}

interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  transcript: string;
  interimTranscript: string;
}

export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: false,
    error: null,
    transcript: '',
    interimTranscript: ''
  });

  const onResultRef = useRef(options.onResult);
  const onEndRef = useRef(options.onEnd);
  const onErrorRef = useRef(options.onError);
  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);

  useEffect(() => {
    onResultRef.current = options.onResult;
    onEndRef.current = options.onEnd;
    onErrorRef.current = options.onError;
  }, [options.onResult, options.onEnd, options.onError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false, error: 'Speech recognition not supported' }));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = options.continuous ?? true;
      recognition.interimResults = options.interimResults ?? true;
      recognition.lang = options.lang || 'fr-FR';

      recognition.onresult = (event: any) => {
        let finalSegment = '';
        let interimSegment = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalSegment += transcript;
          } else {
            interimSegment += transcript;
          }
        }

        if (finalSegment.trim()) {
          console.log(`[VOICE_HOOK] 🎙️ Texte final détecté : "${finalSegment.trim()}"`);
          onResultRef.current?.(finalSegment.trim());
        }

        setState(prev => ({
          ...prev,
          transcript: finalSegment.trim() || prev.transcript,
          interimTranscript: interimSegment.trim()
        }));
      };

      recognition.onstart = () => {
        console.log('[VOICE_HOOK] 🟢 Microphone actif');
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onend = () => {
        console.log('[VOICE_HOOK] 🔴 Microphone inactif');
        setState(prev => ({ ...prev, isListening: false }));
        onEndRef.current?.();

        if (options.autoRestart && !isManuallyStopped.current) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            // Silencieux
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          console.warn('[VOICE_HOOK] ⚠️ Accès micro refusé');
        } else if (event.error !== 'no-speech') {
          console.error(`[VOICE_HOOK] ❌ Erreur : ${event.error}`);
        }
        
        setState(prev => ({ ...prev, isListening: false, error: event.error }));
        onErrorRef.current?.(event.error);
      };

      setState(prev => ({ ...prev, isSupported: true }));

    } catch (error) {
      console.error('[VOICE_HOOK] ❌ Initialisation échouée');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [options.lang, options.continuous, options.interimResults, options.autoRestart]);

  const startListening = useCallback(() => {
    isManuallyStopped.current = false;
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn('[VOICE_HOOK] Déjà actif ou erreur de démarrage');
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
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { ...state, startListening, stopListening, speak };
}
