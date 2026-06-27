
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
  volume: number;
}

/**
 * Hook de contrôle vocal avancé pour VisioNode.
 * Gère la reconnaissance (STT) et la synthèse (TTS) avec feedback de signal.
 */
export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
    volume: 0,
  });

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isManuallyStopped = useRef(false);
  
  // Utilisation de Refs pour les callbacks afin d'éviter les dépendances circulaires
  const onResultRef = useRef(options.onResult);
  const onEndRef = useRef(options.onEnd);
  
  useEffect(() => {
    onResultRef.current = options.onResult;
    onEndRef.current = options.onEnd;
  }, [options.onResult, options.onEnd]);

  // Initialisation STT
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options.lang || 'fr-FR';

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
        isManuallyStopped.current = false;
        startVolumeAnalysis();
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript && onResultRef.current) {
          onResultRef.current(finalTranscript.trim());
        }
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false, volume: 0 }));
        stopVolumeAnalysis();
        
        if (options.autoRestart && !isManuallyStopped.current) {
          try { recognition.start(); } catch (e) {}
        }
        
        if (onEndRef.current) onEndRef.current();
      };

      recognition.onerror = (event: any) => {
        const errorMsg = typeof event.error === 'string' ? event.error : "ERREUR_RECONNAISSANCE_INCONNUE";
        if (errorMsg === 'no-speech') return;
        setState(prev => ({ ...prev, error: errorMsg, isListening: false }));
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopVolumeAnalysis();
    };
  }, [options.lang, options.autoRestart]);

  const startVolumeAnalysis = async () => {
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return;
      if (audioContextRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        setState(prev => ({ ...prev, volume: average / 128 }));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn("Signal audio indisponible pour visualisation.");
    }
  };

  const stopVolumeAnalysis = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e) {}
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try { 
        recognitionRef.current.start(); 
      } catch (e) {}
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [options.lang]);

  return { ...state, startListening, stopListening, speak };
}
