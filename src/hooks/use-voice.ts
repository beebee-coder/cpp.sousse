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
  const isManuallyStopped = useRef(true);
  
  const onResultRef = useRef(options.onResult);
  const onEndRef = useRef(options.onEnd);
  
  useEffect(() => {
    onResultRef.current = options.onResult;
    onEndRef.current = options.onEnd;
  }, [options.onResult, options.onEnd]);

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
        startVolumeAnalysis();
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        
        if (transcript && onResultRef.current) {
          onResultRef.current(transcript);
        }
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false, volume: 0 }));
        stopVolumeAnalysis();
        
        // Auto-restart if not manually stopped (for continuous mode flow)
        if (options.autoRestart && !isManuallyStopped.current) {
          try { 
            recognition.start(); 
          } catch (e) {
            console.warn("SpeechRecognition auto-restart failed", e);
          }
        }
        
        if (onEndRef.current) onEndRef.current();
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.error("SpeechRecognition error:", event.error);
        setState(prev => ({ ...prev, error: event.error, isListening: false }));
      };

      recognitionRef.current = recognition;
    }
  }, [options.lang, options.autoRestart]);

  const startVolumeAnalysis = async () => {
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return;

      if (!audioContextRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        audioContextRef.current = context;
        analyserRef.current = analyser;
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const bufferLength = analyserRef.current!.frequencyBinCount;
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
    animationFrameRef.current = null;
  };

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      isManuallyStopped.current = false;
      try { 
        recognitionRef.current.start(); 
      } catch (e) {
        // already started
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try { 
        recognitionRef.current.stop(); 
      } catch (e) {
        // already stopped
      }
    }
  }, []);

  const restart = useCallback(() => {
    if (recognitionRef.current) {
      isManuallyStopped.current = false;
      recognitionRef.current.stop();
      // onend will automatically restart if autoRestart is true
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const wasListening = !isManuallyStopped.current;
    if (wasListening) recognitionRef.current?.stop();

    utterance.onend = () => {
      if (wasListening && !isManuallyStopped.current) {
        try { recognitionRef.current?.start(); } catch(e) {}
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [options.lang]);

  return { ...state, startListening, stopListening, restart, speak };
}
