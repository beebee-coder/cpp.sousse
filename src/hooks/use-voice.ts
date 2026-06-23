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
  
  // Utilisation d'une ref pour onResult afin d'éviter les closures obsolètes
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
          if (transcript && onResultRef.current) {
            onResultRef.current(transcript.trim());
          }
        };

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(event.error);
          }
          setIsListening(false);
        };
      } catch (e) {
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
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {}
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
