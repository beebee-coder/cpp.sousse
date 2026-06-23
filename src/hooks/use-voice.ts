
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
  
  // Utilisation d'une Ref pour le callback afin de toujours avoir la version la plus récente
  // sans recréer l'instance SpeechRecognition
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
          // Récupération sécurisée du dernier segment transcrit
          const results = event.results;
          const lastResult = results[results.length - 1];
          
          if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript;
            const cleanText = transcript.trim();
            
            console.log(`[VOICE_HOOK] 🎙️ Texte détecté : "${cleanText}"`);
            
            if (cleanText && onResultRef.current) {
              onResultRef.current(cleanText);
            }
          }
        };

        recognition.onstart = () => {
          console.log(`[VOICE_HOOK] 🟢 Session active`);
          setIsListening(true);
        };

        recognition.onend = () => {
          console.log(`[VOICE_HOOK] 🔴 Session terminée`);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error(`[VOICE_HOOK] ❌ Erreur :`, event.error);
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(event.error);
          }
          setIsListening(false);
        };
      } catch (e) {
        console.error(`[VOICE_HOOK] ❌ Échec init :`, e);
        setIsSupported(false);
      }
    }

    return () => {
      // Nettoyage strict sans déclencher d'événements de déchargement interdits
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
    if (!recognitionRef.current) {
      console.warn(`[VOICE_HOOK] ⚠️ Instance manquante`);
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Si déjà démarré, on ignore
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
