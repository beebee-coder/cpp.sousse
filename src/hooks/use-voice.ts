
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  lang?: string;
}

export function useVoice(options: VoiceOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const onResultRef = useRef(options.onResult);
  onResultRef.current = options.onResult;

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = options.lang || 'fr-FR';

        recognition.onresult = (event: any) => {
          let transcript = '';
          // Traitement robuste de tous les nouveaux résultats
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }

          const cleanText = transcript.trim();
          if (cleanText) {
            console.log(`[VOICE_HOOK] 🎙️ Segment transcrit : "${cleanText}"`);
            if (onResultRef.current) {
              onResultRef.current(cleanText);
            }
          }
        };

        recognition.onstart = () => {
          console.log(`[VOICE_HOOK] 🟢 Session microphone active`);
          setIsListening(true);
        };

        recognition.onend = () => {
          console.log(`[VOICE_HOOK] 🔴 Session microphone terminée`);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          // Gestion silencieuse des erreurs de sécurité pour éviter le crash de l'UI
          if (event.error === 'not-allowed') {
            console.warn(`[VOICE_HOOK] ⚠️ Accès microphone refusé.`);
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.error(`[VOICE_HOOK] ❌ Erreur technique :`, event.error);
            setError(event.error);
          }
          setIsListening(false);
        };
      } catch (e) {
        console.error(`[VOICE_HOOK] ❌ Échec initialisation Speech API :`, e);
        setIsSupported(false);
      }
    }

    return () => {
      // Nettoyage sécurisé sans utiliser 'unload'
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [options.lang]);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Ignorer si déjà démarré
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string, lang = 'fr-FR') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }, []);

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    speak,
    cancelSpeak: () => window.speechSynthesis?.cancel()
  };
}
