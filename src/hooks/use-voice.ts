
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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Vérification de la compatibilité navigateur
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = options.lang || 'fr-FR';

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (options.onResult) options.onResult(text);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (options.onEnd) options.onEnd();
      };

      recognition.onerror = (event: any) => {
        // "not-allowed" signifie que l'utilisateur ou le navigateur bloque le micro
        // On évite console.error pour ne pas polluer les logs de dev en cas de refus volontaire
        const errorMsg = event.error === 'not-allowed' 
          ? "Accès micro refusé. Vérifiez vos paramètres navigateur." 
          : event.error;
        
        setError(errorMsg);
        setIsListening(false);
        
        if (options.onError) options.onError(errorMsg);
      };
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignorer les erreurs d'arrêt si déjà inactif
        }
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
      // Si déjà en train d'écouter, on ignore l'erreur d'état
      if (e.name !== 'InvalidStateError') {
        setError(e.message);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      // Ignorer
    }
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
