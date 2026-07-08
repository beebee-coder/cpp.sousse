'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onCorrection?: () => void;
  lang?: string;
  autoRestart?: boolean;
}

export interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  volume: number;
  isSpeaking: boolean;
}

export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
    volume: 0,
    isSpeaking: false,
  });

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isManuallyStopped = useRef(true);

  const onResultRef = useRef(options.onResult);
  const onEndRef = useRef(options.onEnd);
  const onCorrectionRef = useRef(options.onCorrection);

  const lastTranscriptRef = useRef<string | null>(null);
  const lastResultTimeRef = useRef<number>(0);

  useEffect(() => {
    onResultRef.current = options.onResult;
    onEndRef.current = options.onEnd;
    onCorrectionRef.current = options.onCorrection;
  }, [options.onResult, options.onEnd, options.onCorrection]);

  const stopVolumeAnalysis = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    setState(prev => ({ ...prev, volume: 0 }));
  }, []);

  const startVolumeAnalysis = useCallback(async () => {
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
      console.warn('Signal audio indisponible.');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = options.lang || 'fr-FR';

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
        startVolumeAnalysis();
      };

      recognition.onresult = (event: any) => {
        if (state.isSpeaking) return;

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        const now = Date.now();
        const isDuplicate = transcript === lastTranscriptRef.current && now - lastResultTimeRef.current < 1200;
        lastTranscriptRef.current = transcript;
        lastResultTimeRef.current = now;

        if (!transcript || isDuplicate) return;

        if (onResultRef.current) {
          onResultRef.current(transcript);
        }

        if (onCorrectionRef.current) {
          const normalized = transcript.trim().toLowerCase();
          if (/^non[.!?\s]*$/i.test(normalized)) {
            onCorrectionRef.current();
          }
        }
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
        stopVolumeAnalysis();

        if (options.autoRestart && !isManuallyStopped.current && !state.isSpeaking) {
          try { recognition.start(); } catch (e) {}
        }

        if (onEndRef.current) onEndRef.current();
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        setState(prev => ({ ...prev, error: event.error, isListening: false }));
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopVolumeAnalysis();
    };
  }, [options.lang, options.autoRestart, startVolumeAnalysis, stopVolumeAnalysis]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      isManuallyStopped.current = false;
      lastTranscriptRef.current = null;
      lastResultTimeRef.current = 0;
      try { recognitionRef.current.start(); } catch (e) {}
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    stopVolumeAnalysis();
  }, [stopVolumeAnalysis]);

  const restart = useCallback(() => {
    if (recognitionRef.current && !state.isSpeaking) {
      isManuallyStopped.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, [state.isSpeaking]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const wasListening = !isManuallyStopped.current;
    if (wasListening) recognitionRef.current?.stop();

    setState(prev => ({ ...prev, isSpeaking: true }));
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'fr-FR';
    utterance.rate = 1.0;

    utterance.onend = () => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      if (wasListening && !isManuallyStopped.current) {
        setTimeout(() => {
          if (!isManuallyStopped.current) {
            try { recognitionRef.current?.start(); } catch (e) {}
          }
        }, 600);
      }
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      if (wasListening && !isManuallyStopped.current) {
        setTimeout(() => {
          if (!isManuallyStopped.current) {
            try { recognitionRef.current?.start(); } catch (e) {}
          }
        }, 600);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [options.lang]);

  return {
    isListening: state.isListening,
    isSupported: state.isSupported,
    error: state.error,
    volume: state.volume,
    isSpeaking: state.isSpeaking,
    startListening,
    stopListening,
    restart,
    speak,
  };
}
