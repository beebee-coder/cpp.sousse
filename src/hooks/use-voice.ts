'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceOptions {
  onResult?: (text: string) => void;
  onInterim?: (text: string) => void;
  onEnd?: () => void;
  onCorrection?: () => void;
  onActivate?: () => void;
  lang?: string;
  autoRestart?: boolean;
}

export interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  volume: number;
  isSpeaking: boolean;
  isPaused: boolean;
  interimTranscript: string;
}

export function useVoice(options: VoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSupported: true,
    error: null,
    volume: 0,
    isSpeaking: false,
    isPaused: false,
    interimTranscript: '',
  });

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const volumeActiveRef = useRef(false);           // guard double-RAF
  const isManuallyStopped = useRef(true);
  const suppressActivateRef = useRef(false);
  const ttsCooldownUntilRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const onActivateRef = useRef<(() => void) | undefined>(undefined);
  const logIdRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef<number>(Date.now());
  const speakStartTimeRef = useRef(0);             // for adaptive cooldown
  const isAutoRestartingRef = useRef(false);       // to identify auto-restarts and suppress greet voice
  const speakingGuardRef = useRef(false);          // prevent double handleEnd
  const speechCancelledRef = useRef(false);        // block further speak() after manual cancel
  const isPausedRef = useRef(false);               // TTS pause state
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null); // track active utterance

  const log = useCallback((action: string, payload?: Record<string, any>) => {
    const id = ++logIdRef.current;
    console.log(`[VOICE:${id}]`, {
      action,
      ts: Date.now(),
      render: renderCountRef.current,
      state: {
        isListening: stateRef.current.isListening,
        isSpeaking: stateRef.current.isSpeaking,
        volume: stateRef.current.volume,
        error: stateRef.current.error,
      },
      refs: {
        isManuallyStopped: isManuallyStopped.current,
        suppressActivate: suppressActivateRef.current,
        ttsCooldownUntil: ttsCooldownUntilRef.current,
        isSpeakingRef: isSpeakingRef.current,
      },
      ...payload,
    });
  }, []);

  const onResultRef = useRef(options.onResult);
  const onInterimRef = useRef(options.onInterim);
  const onEndRef = useRef(options.onEnd);
  const onCorrectionRef = useRef(options.onCorrection);

  const lastTranscriptRef = useRef<string | null>(null);
  const lastResultTimeRef = useRef<number>(0);
  const hasLoggedInit = useRef(false);

  useEffect(() => {
    onResultRef.current = options.onResult;
    onInterimRef.current = options.onInterim;
    onEndRef.current = options.onEnd;
    onCorrectionRef.current = options.onCorrection;
    onActivateRef.current = options.onActivate;
  }, [options.onResult, options.onInterim, options.onEnd, options.onCorrection, options.onActivate]);

  renderCountRef.current += 1;
  const now = Date.now();
  const delta = now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;
  if (renderCountRef.current % 60 === 0 || delta > 1000) {
    log('RENDER', { count: renderCountRef.current, delta });
  }

  if (!hasLoggedInit.current) {
    hasLoggedInit.current = true;
    log('INIT', { lang: options.lang || 'fr-FR', autoRestart: options.autoRestart });
  }

  const stopVolumeAnalysis = useCallback(() => {
    if (!volumeActiveRef.current) return;
    log('STOP_VOLUME_ANALYSIS');
    volumeActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setState(prev => ({ ...prev, volume: 0 }));
  }, [log]);

  const startVolumeAnalysis = useCallback(async () => {
    // Guard: don't start a second RAF loop if already active
    if (volumeActiveRef.current) return;
    volumeActiveRef.current = true;
    log('START_VOLUME_ANALYSIS');
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return;

      if (!audioContextRef.current) {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          log('VOLUME_ANALYSIS_PERMISSION_DENIED', { error: (e as Error).message });
          volumeActiveRef.current = false;
          return;
        }
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
        if (!volumeActiveRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        setState(prev => ({ ...prev, volume: average / 128 }));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      log('VOLUME_ANALYSIS_ERROR', { error: (e as Error).message });
      volumeActiveRef.current = false;
      console.warn('Signal audio indisponible.');
    }
  }, [log]);

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
        log('RECOGNITION_ONSTART');
        setState(prev => ({ ...prev, isListening: true, error: null, interimTranscript: '' }));
        startVolumeAnalysis();
        if (!suppressActivateRef.current && onActivateRef.current && !isManuallyStopped.current && !isAutoRestartingRef.current) {
          onActivateRef.current();
        }
        isAutoRestartingRef.current = false;
        suppressActivateRef.current = false;
      };

      recognition.onresult = (event: any) => {
        const isSynthSpeaking = typeof window !== 'undefined' && window.speechSynthesis?.speaking;
        const nowMs = Date.now();
        if (isSpeakingRef.current || isSynthSpeaking || nowMs < ttsCooldownUntilRef.current) {
          log('RECOGNITION_ONRESULT_SUPPRESSED', { 
            reason: isSpeakingRef.current || isSynthSpeaking ? 'isSpeakingRef_or_synthSpeaking' : 'ttsCooldown',
            isSynthSpeaking,
            remaining: ttsCooldownUntilRef.current - nowMs
          });
          return;
        }

        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += t;
          } else {
            interimText += t;
          }
        }

        // Show interim in real-time
        if (interimText) {
          setState(prev => ({ ...prev, interimTranscript: interimText }));
          onInterimRef.current?.(interimText);
        }

        if (!finalText) return;

        // Deduplicate final results
        const isDuplicate = finalText === lastTranscriptRef.current && nowMs - lastResultTimeRef.current < 1200;
        lastTranscriptRef.current = finalText;
        lastResultTimeRef.current = nowMs;

        if (isDuplicate) {
          log('RECOGNITION_ONRESULT_IGNORED', { transcript: finalText?.slice(0, 50), isDuplicate });
          return;
        }

        setState(prev => ({ ...prev, interimTranscript: '' }));
        log('RECOGNITION_ONRESULT', { transcript: finalText.slice(0, 120) });
        onResultRef.current?.(finalText);

        if (onCorrectionRef.current) {
          const normalized = finalText.trim().toLowerCase();
          if (/^non[.!?\s]*$/i.test(normalized)) {
            log('RECOGNITION_CORRECTION');
            onCorrectionRef.current();
          }
        }
      };

      recognition.onend = () => {
        log('RECOGNITION_ONEND');
        setState(prev => ({ ...prev, isListening: false, interimTranscript: '' }));
        stopVolumeAnalysis();

        // Race condition guard: wait 150ms to ensure isSpeakingRef is set before checking
        setTimeout(() => {
          if (options.autoRestart && !isManuallyStopped.current && !isSpeakingRef.current) {
            log('RECOGNITION_AUTO_RESTART');
            try { recognition.start(); } catch (e) {
              log('RECOGNITION_AUTO_RESTART_ERROR', { error: (e as Error).message });
            }
          }
          onEndRef.current?.();
        }, 150);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          log('RECOGNITION_ONERROR_IGNORED', { error: event.error });
          return;
        }
        log('RECOGNITION_ONERROR', { error: event.error });
        setState(prev => ({ ...prev, error: event.error, isListening: false }));
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopVolumeAnalysis();
    };
  }, [options.lang, options.autoRestart, startVolumeAnalysis, stopVolumeAnalysis, log]);

  const startListening = useCallback(() => {
    log('START_LISTENING', { isManuallyStopped: isManuallyStopped.current, isSpeaking: isSpeakingRef.current });
    
    // Barge-in: if TTS is speaking, cancel it immediately
    if (isSpeakingRef.current || (typeof window !== 'undefined' && window.speechSynthesis?.speaking)) {
      log('BARGE_IN_CANCEL_TTS');
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      isPausedRef.current = false;
      currentUtteranceRef.current = null;
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    }
    
    if (recognitionRef.current) {
      isManuallyStopped.current = false;
      lastTranscriptRef.current = null;
      lastResultTimeRef.current = 0;
      try { recognitionRef.current.start(); } catch (e) {
        log('START_LISTENING_ERROR', { error: (e as Error).message });
      }
    }
  }, [log]);

  const stopListening = useCallback(() => {
    log('STOP_LISTENING', { isManuallyStopped: isManuallyStopped.current });
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {
        log('STOP_LISTENING_ERROR', { error: (e as Error).message });
      }
    }
    stopVolumeAnalysis();
    setState(prev => ({ ...prev, interimTranscript: '' }));
  }, [log, stopVolumeAnalysis]);

  const restart = useCallback(() => {
    log('RESTART_REQUESTED', { isSpeaking: isSpeakingRef.current });
    if (recognitionRef.current && !isSpeakingRef.current) {
      isManuallyStopped.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) { log('RESTART_ERROR', { error: (e as Error).message }); }
    }
  }, [log]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      log('SPEAK_SKIPPED', { reason: 'speechSynthesis_unavailable' });
      return;
    }

    if (speechCancelledRef.current) {
      log('SPEAK_BLOCKED', { reason: 'cancelled_by_user' });
      return;
    }

    const wasListening = !isManuallyStopped.current;
    log('SPEAK_START', { text: text.slice(0, 120), wasListening });
    speakStartTimeRef.current = Date.now();
    speakingGuardRef.current = false;
    isPausedRef.current = false;

    if (wasListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        log('SPEAK_ABORT_RECOGNITION_ERROR', { error: (e as Error).message });
      }
    }

    isSpeakingRef.current = true;
    setState(prev => ({ ...prev, isSpeaking: true, isPaused: false, interimTranscript: '' }));
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;
    utterance.lang = options.lang || 'fr-FR';
    utterance.rate = 1.0;

    const handleEnd = () => {
      if (speakingGuardRef.current) return;
      speakingGuardRef.current = true;

      const duration = Date.now() - speakStartTimeRef.current;
      const adaptiveCooldown = Math.max(2500, Math.min(6000, duration * 0.35 + 1200));
      log('SPEAK_END', { wasListening, isManuallyStopped: isManuallyStopped.current, duration, adaptiveCooldown });
      isSpeakingRef.current = false;
      isPausedRef.current = false;
      currentUtteranceRef.current = null;
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
      ttsCooldownUntilRef.current = Date.now() + adaptiveCooldown;

      if (wasListening && !isManuallyStopped.current) {
        suppressActivateRef.current = true;
        setTimeout(() => {
          log('SPEAK_AUTO_RESTART_DEFERRED');
          if (!isManuallyStopped.current) {
            try {
              isAutoRestartingRef.current = true;
              recognitionRef.current?.start();
            } catch (e) {
              log('SPEAK_AUTO_RESTART_ERROR', { error: (e as Error).message });
            }
          }
          suppressActivateRef.current = false;
        }, 1200);
      }
    };

    utterance.onend = handleEnd;
    utterance.onerror = (e) => {
      log('SPEAK_ERROR', { error: (e as any).error });
      handleEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, [options.lang, log]);

  const cancel = useCallback(() => {
    log('CANCEL');
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    speechCancelledRef.current = true;
    isSpeakingRef.current = false;
    isPausedRef.current = false;
    currentUtteranceRef.current = null;
    setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
  }, [log]);

  const pause = useCallback(() => {
    log('PAUSE');
    if (typeof window === 'undefined' || !window.speechSynthesis || !isSpeakingRef.current) return;
    window.speechSynthesis.pause();
    isPausedRef.current = true;
    setState(prev => ({ ...prev, isPaused: true }));
  }, [log]);

  const resume = useCallback(() => {
    log('RESUME');
    if (typeof window === 'undefined' || !window.speechSynthesis || !isPausedRef.current) return;
    window.speechSynthesis.resume();
    isPausedRef.current = false;
    setState(prev => ({ ...prev, isPaused: false }));
  }, [log]);

  const resetSpeechBlock = useCallback(() => {
    log('RESET_SPEECH_BLOCK');
    speechCancelledRef.current = false;
  }, [log]);

  return {
    isListening: state.isListening,
    isSupported: state.isSupported,
    error: state.error,
    volume: state.volume,
    isSpeaking: state.isSpeaking,
    isPaused: state.isPaused,
    interimTranscript: state.interimTranscript,
    startListening,
    stopListening,
    restart,
    speak,
    cancel,
    pause,
    resume,
    resetSpeechBlock,
    isSpeechCancelled: () => speechCancelledRef.current,
  };
}
