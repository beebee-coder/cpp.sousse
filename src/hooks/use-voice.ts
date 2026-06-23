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
          const transcript = event.results[event.results.length - 1][0].transcript;
          const cleanText = transcript.trim();
          
          console.log(`[VOICE_HOOK] 🎙️ Texte détecté par le navigateur : "${cleanText}"`);
          
          if (cleanText && onResultRef.current) {
            console.log(`[VOICE_HOOK] 📤 Envoi du texte au composant parent...`);
            onResultRef.current(cleanText);
          }
        };

        recognition.onstart = () => {
          console.log(`[VOICE_HOOK] 🟢 Microphone ACTIF (Enregistrement en cours...)`);
          setIsListening(true);
        };

        recognition.onend = () => {
          console.log(`[VOICE_HOOK] 🔴 Microphone INACTIF (Fin de session)`);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error(`[VOICE_HOOK] ❌ Erreur API Speech :`, event.error);
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(event.error);
          }
          setIsListening(false);
        };
      } catch (e) {
        console.error(`[VOICE_HOOK] ❌ Échec initialisation SpeechRecognition :`, e);
        setIsSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [options.lang]);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) {
      console.warn(`[VOICE_HOOK] ⚠️ Tentative de démarrage sans instance recognition.`);
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(`[VOICE_HOOK] ⚠️ Erreur lors du start() :`, e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
