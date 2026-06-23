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
  
  // Utilisation de Refs pour éviter de recréer l'objet recognition à chaque changement de state parent
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = options.lang || 'fr-FR';

        recognition.onresult = (event: any) => {
          // Récupération du dernier résultat transcrit
          const results = event.results;
          const transcript = results[results.length - 1][0].transcript;
          
          if (optionsRef.current.onResult) {
            optionsRef.current.onResult(transcript);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          if (optionsRef.current.onEnd) {
            optionsRef.current.onEnd();
          }
        };

        recognition.onerror = (event: any) => {
          const errorMsg = event.error === 'not-allowed' 
            ? "Accès micro refusé. Vérifiez vos paramètres navigateur." 
            : event.error;
          
          setError(errorMsg);
          setIsListening(false);
          
          if (optionsRef.current.onError) {
            optionsRef.current.onError(errorMsg);
          }
        };
      } catch (e) {
        console.warn("[VOICE] Échec initialisation API Speech.");
        setIsSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        // Nettoyage des listeners pour éviter les fuites mémoire
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
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
      setIsListening(true);
    } catch (e: any) {
      if (e.name !== 'InvalidStateError') {
        setError(e.message);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string, lang = 'fr-FR') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') && v.name.includes('Google')) || 
                   voices.find(v => v.lang.startsWith('fr'));
    
    if (frVoice) utterance.voice = frVoice;

    window.speechSynthesis.speak(utterance);
  }, []);

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    speak,
    cancelSpeak: () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  };
}
