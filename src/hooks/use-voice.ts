
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
  
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialisation STT
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = optionsRef.current.lang || 'fr-FR';

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
      
      if (finalTranscript && optionsRef.current.onResult) {
        optionsRef.current.onResult(finalTranscript.trim());
      }
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false, volume: 0 }));
      stopVolumeAnalysis();
      
      if (optionsRef.current.autoRestart && !isManuallyStopped.current) {
        try { recognition.start(); } catch (e) {}
      }
      
      if (optionsRef.current.onEnd) optionsRef.current.onEnd();
    };

    recognition.onerror = (event: any) => {
      // Ignore some common minor errors
      if (event.error === 'no-speech') return;
      setState(prev => ({ ...prev, error: event.error, isListening: false }));
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      stopVolumeAnalysis();
    };
  }, []);

  const startVolumeAnalysis = async () => {
    try {
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
        setState(prev => ({ ...prev, volume: average / 128 })); // Normalisé 0-1
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {}
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
      } catch (e) {
        // Recognition already started or error
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Stop listening while speaking to avoid feedback loop
    const wasListening = state.isListening;
    if (wasListening) stopListening();

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      // Re-enable listening if it was active (optional, usually handled by caller)
    };

    window.speechSynthesis.speak(utterance);
  }, [state.isListening, stopListening]);

  return { ...state, startListening, stopListening, speak };
}
