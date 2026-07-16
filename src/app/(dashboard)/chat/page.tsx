"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Cpu,
  Loader2,
  Shield,
  Zap,
  Activity,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ImageIcon,
  Timer,
  Radio,
  Pause,
  Play,
  Command
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/use-chat';
import { useVoice } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';

/* ─── Waveform bars animated via RAF ────────────────────────────── */
function VoiceWaveform({ volume, active, color = 'primary' }: {
  volume: number;
  active: boolean;
  color?: 'primary' | 'secondary' | 'red';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colorMap = {
      primary: 'hsl(191 70% 56%)',
      secondary: 'hsl(163 65% 48%)',
      red: 'hsl(0 84% 60%)',
    };
    const barColor = colorMap[color];
    const BARS = 28;

    const draw = (time: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!active) {
        rafRef.current = null;
        return;
      }

      phaseRef.current += 0.06;
      const gap = 2;
      const barW = (W - gap * (BARS - 1)) / BARS;

      for (let i = 0; i < BARS; i++) {
        const sinVal = (Math.sin(i * 0.55 + phaseRef.current) + 1) / 2;
        const noise = (Math.sin(i * 0.3 + time * 0.002) + 1) / 2 * 0.15;
        const heightFactor = Math.max(0.08, sinVal * (volume + noise));
        const barH = heightFactor * H;
        const x = i * (barW + gap);
        const y = (H - barH) / 2;

        const alpha = 0.35 + heightFactor * 0.65;
        ctx.fillStyle = barColor;
        ctx.globalAlpha = alpha;
        const radius = Math.min(barW / 2, 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, radius);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    if (active && !rafRef.current) {
      const loop = (time: number) => {
        draw(time);
        if (rafRef.current) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } else if (!active) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, volume, color]);

  return (
    <canvas
      ref={canvasRef}
      width={140}
      height={24}
      className="w-full h-6"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

/* ─── Circular countdown SVG ────────────────────────────────────── */
function CountdownRing({ seconds, total = 3, onCancel }: { seconds: number; total?: number; onCancel?: () => void }) {
  const R = 10;
  const C = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(1, seconds / total));
  const dash = C * progress;
  const gap = C - dash;

  return (
    <div className="shrink-0 flex items-center gap-1">
      <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
        {/* Track */}
        <circle cx="14" cy="14" r={R} fill="none" stroke="hsl(191 70% 56% / 0.15)" strokeWidth="2.5" />
        {/* Progress */}
        <circle
          cx="14" cy="14" r={R}
          fill="none"
          stroke="hsl(191 70% 56%)"
          strokeWidth="2.5"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform="rotate(-90 14 14)"
          style={{ transition: 'stroke-dasharray 0.25s linear' }}
        />
        {/* Number */}
        <text
          x="14" y="14"
          textAnchor="middle"
          dominantBaseline="central"
          fill="hsl(191 70% 56%)"
          fontSize="8"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {Math.ceil(seconds)}
        </text>
      </svg>
      {onCancel && (
        <button
          onClick={onCancel}
          title="Annuler l'envoi automatique"
          className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <span className="text-[10px] font-bold leading-none">×</span>
        </button>
      )}
    </div>
  );
}

/* ─── Main Chat Page ─────────────────────────────────────────────── */
export default function ChatPage() {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  /* countdown state */
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<string>('');

  const { messages, sendMessage, clearChat, isLoading, currentProvider } = useChat((text) => {
    if (autoSpeak && text) {
      const cancelled = voiceRef.current?.isSpeechCancelled?.();
      if (!cancelled) {
        voiceRef.current?.speak(text);
      }
    }
  });

  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  const [detectedCommand, setDetectedCommand] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<ReturnType<typeof useVoice> | null>(null);
  const shouldGreetRef = useRef(false);
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ── clear countdown helper ─────────────────────────────────── */
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    setCountdown(null);
  }, []);

  /* ── start 3s countdown then autosend ───────────────────────── */
  const startAutoSendCountdown = useCallback((text: string) => {
    clearCountdown();

    const TOTAL = 3;
    setCountdown(TOTAL);

    let remaining = TOTAL;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 0.1;
      setCountdown(Math.max(0, Number((remaining).toFixed(1))));
      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
      }
    }, 100);

    autoSendTimerRef.current = setTimeout(() => {
      if (voiceRef.current?.isSpeaking) {
        console.log('[CHAT:AUTOSEND_ABORTED]', { reason: 'isSpeaking' });
        clearCountdown();
        return;
      }
      if (inputRef.current.trim() && inputRef.current.trim() !== text.trim()) {
        console.log('[CHAT:AUTOSEND_ABORTED]', { reason: 'user_edited_input' });
        clearCountdown();
        return;
      }
      const finalText = inputRef.current.trim() || text;
      if (finalText) {
        console.log('[CHAT:AUTOSEND]', { text: finalText.slice(0, 120), source: 'voice' });
        sendMessage(finalText, 'voice');
        setInput('');
        setIsVoiceInput(false);
        inputRef.current = '';
        voiceRef.current?.restart();
      }
      setCountdown(null);
      autoSendTimerRef.current = null;
    }, TOTAL * 1000);
  }, [clearCountdown, sendMessage]);

  /* ── manual submit ──────────────────────────────────────────── */
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const speaking = voiceRef.current?.isSpeaking ?? false;
    if (input.trim() && !isLoading && !speaking) {
      clearCountdown();
      const text = input;
      const source = isVoiceInput ? 'voice' : 'text';
      console.log('[CHAT:SUBMIT]', { text: text.slice(0, 120), source });
      sendMessage(text, source);
      setInput('');
      setIsVoiceInput(false);
      inputRef.current = '';
      voiceRef.current?.restart();
    }
  };

  /* ── voice result (final transcript) ───────────────────────── */
  const handleVoiceResult = useCallback((text: string) => {
    if (voiceRef.current?.isSpeaking) {
      console.log('[CHAT:VOICE_RESULT_IGNORED]', { reason: 'isSpeaking' });
      return;
    }
    
    // Detect voice commands for UI feedback
    const { matchVoiceAction } = require('@/lib/procedures/assistants/voice-commands');
    const command = matchVoiceAction(text);
    if (command) {
      setDetectedCommand(command.action);
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = setTimeout(() => setDetectedCommand(null), 2000);
    }
    
    setInput(text);
    setIsVoiceInput(true);
    inputRef.current = text;
    console.log('[CHAT:VOICE_RESULT]', { text: text.slice(0, 120), command: command?.action || null });
    if (text.trim() && !isLoading) {
      startAutoSendCountdown(text);
    }
  }, [isLoading, startAutoSendCountdown]);

  /* ── interim transcript → show in input in real time ───────── */
  const handleVoiceInterim = useCallback((text: string) => {
    if (voiceRef.current?.isSpeaking) return;
    setInput(text);
    setIsVoiceInput(true);
  }, []);

  /* ── voice activate ─────────────────────────────────────────── */
  const handleVoiceActivate = useCallback(() => {
    console.log('[CHAT:VOICE_ACTIVATE]');
    const inputEl = document.querySelector('input[data-voice-input]') as HTMLInputElement | null;
    if (inputEl) {
      inputEl.focus();
    }
    if (shouldGreetRef.current) {
      shouldGreetRef.current = false;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setTimeout(() => {
        voiceRef.current?.speak('Je vous écoute. Posez votre question ou donnez une commande.');
      }, 150);
    }
  }, []);

  const voice = useVoice({
    onResult: handleVoiceResult,
    onInterim: handleVoiceInterim,
    onActivate: handleVoiceActivate,
    autoRestart: true,
    lang: 'fr-FR',
  });
  voiceRef.current = voice;

  /* ── scroll to bottom on new message ───────────────────────── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  /* ── cleanup on unmount ─────────────────────────────────────── */
  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, [clearCountdown]);

  /* ── toggle Navbar Mic ───────────────────────────────────────── */
  const toggleNavbarMic = () => {
    if (voice.isListening) {
      console.log('[CHAT:NAVBAR_MIC_STOP]');
      clearCountdown();
      voice.stopListening();
    } else {
      console.log('[CHAT:NAVBAR_MIC_START]');
      shouldGreetRef.current = true;
      voice.startListening();
    }
  };

  /* ── toggle TTS ─────────────────────────────────────────────── */
  const toggleAudio = () => {
    if (voice.isSpeaking) {
      console.log('[CHAT:AUDIO_CANCEL]');
      voiceRef.current?.cancel();
    } else {
      setAutoSpeak(prev => {
        const next = !prev;
        console.log('[CHAT:AUDIO_TOGGLE]', { autoSpeak: next });
        if (next) {
          voiceRef.current?.resetSpeechBlock?.();
        }
        return next;
      });
    }
  };

  /* ── toggle Mic ─────────────────────────────────────────────── */
  const toggleMic = () => {
    if (voice.isListening) {
      console.log('[CHAT:MIC_STOP]');
      clearCountdown();
      voice.stopListening();
    } else {
      console.log('[CHAT:MIC_START]');
      voice.startListening();
    }
  };

  /* ── mic button state ────────────────────────────────────────── */
  const micState: 'idle' | 'listening' | 'blocked' =
    voice.isSpeaking ? 'blocked'
    : voice.isListening ? 'listening'
    : 'idle';

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full">

        {/* ── Header ───────────────────────────────────────────── */}
        <header className="h-16 border-b border-border bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="lg:hidden w-10" />
            <div className="relative flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-xs sm:text-sm uppercase tracking-widest text-primary">
                Groq LPU + Pro-Search
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio toggle */}
            <button
              onClick={toggleAudio}
              title={voice.isSpeaking ? 'Arrêter la synthèse' : (autoSpeak ? 'Désactiver audio auto' : 'Activer audio auto')}
              className={cn(
                'h-8 px-3 flex items-center gap-1.5 rounded-sm text-[9px] uppercase font-code font-bold transition-all border',
                voice.isSpeaking
                  ? 'bg-secondary/10 border-secondary/40 text-secondary animate-pulse'
                  : autoSpeak
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {voice.isSpeaking
                ? <><VolumeX className="w-3 h-3" /><span className="hidden sm:inline">Stop</span></>
                : autoSpeak
                ? <><Volume2 className="w-3 h-3" /><span className="hidden sm:inline">Audio ON</span></>
                : <><VolumeX className="w-3 h-3" /><span className="hidden sm:inline">Audio OFF</span></>
              }
            </button>

            {/* Top Navbar Mic button */}
            <button
              onClick={toggleNavbarMic}
              disabled={!voice.isSupported || isLoading}
              title={voice.isListening ? 'Arrêter la commande vocale' : 'Activer la commande vocale'}
              className={cn(
                'h-8 px-3 flex items-center gap-1.5 rounded-sm text-[9px] uppercase font-code font-bold transition-all border',
                voice.isListening
                  ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-pulse'
                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {voice.isListening ? (
                <><MicOff className="w-3 h-3" /><span className="hidden sm:inline">Écoute</span></>
              ) : (
                <><Mic className="w-3 h-3" /><span className="hidden sm:inline">Micro</span></>
              )}
            </button>

            {/* Reset */}
            <button
              onClick={() => { clearCountdown(); clearChat(); }}
              title="Réinitialiser la conversation"
              className="h-8 px-3 flex items-center gap-1.5 rounded-sm text-[9px] uppercase font-code font-bold border border-border/50 text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-row gap-6 relative">
          <div className="flex-1 flex flex-col gap-3 h-full min-w-0">

            {/* Messages */}
            <ScrollArea className="flex-1 pr-2 sm:pr-4 h-full">
              <div className="space-y-5 pb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[60vh] gap-4 opacity-30 px-4">
                    <Cpu className="w-10 h-10 lg:w-12 lg:h-12 text-primary animate-pulse" />
                    <p className="font-code text-[10px] uppercase tracking-widest text-center">
                      Liaison Neurale Active. RAG Multimédia Prêt.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => {
                  const isCurrentlySpeaking = voice.isSpeaking && messages.length > 0 && i === messages.length - 1 && m.role === 'model';
                  return (
                  <div key={i} className={cn('flex gap-3 sm:gap-4', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar */}
                    <div className={cn(
                      'w-7 h-7 sm:w-8 sm:h-8 rounded-sm flex items-center justify-center shrink-0 border transition-colors',
                      m.role === 'user'
                        ? 'bg-primary/20 border-primary/50'
                        : isCurrentlySpeaking
                        ? 'bg-secondary/20 border-secondary/50 shadow-[0_0_8px_-2px_hsl(163_65%_48%/0.3)]'
                        : 'bg-card border-border'
                    )}>
                      {m.role === 'user'
                        ? <User className="w-3.5 h-3.5 text-primary" />
                        : <Bot className="w-3.5 h-3.5 text-secondary" />
                      }
                    </div>

                    {/* Bubble */}
                    <div className={cn('max-w-[90%] sm:max-w-[85%] space-y-1.5', m.role === 'user' ? 'text-right' : 'text-left')}>
                      {m.source === 'voice' && (
                        <div className={cn('flex items-center gap-1.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                          <Radio className="w-2.5 h-2.5 text-red-400" />
                          <span className="text-[8px] font-code text-red-400 uppercase font-bold tracking-wider">Vocal</span>
                        </div>
                      )}
                      <div className={cn(
                        'p-3 sm:p-4 rounded-sm font-code text-[11px] sm:text-sm leading-relaxed border shadow-sm relative group transition-all',
                        m.role === 'user'
                          ? 'bg-primary/5 border-primary/20 hover:border-primary/35'
                          : isCurrentlySpeaking
                          ? 'bg-secondary/10 border-secondary/30'
                          : 'bg-card/80 border-border hover:border-border/80'
                      )}>
                        {m.content}

                        {/* Media */}
                        {m.media && (
                          <div className="mt-4 border border-primary/20 rounded-sm overflow-hidden bg-black/40 shadow-xl max-w-sm">
                            <div className="p-1 border-b border-primary/10 bg-primary/5 flex items-center gap-2">
                              <ImageIcon className="w-3 h-3 text-primary" />
                              <span className="text-[8px] font-bold text-primary uppercase">Fichier Registre Détecté</span>
                            </div>
                            {m.media.type === 'image'
                              ? <img src={m.media.url} className="w-full h-auto object-contain max-h-[300px]" alt="RAG Asset" />
                              : <video src={m.media.url} controls className="w-full h-auto max-h-[300px]" />
                            }
                          </div>
                        )}

                        {/* Per-message TTS button + provider badge */}
                        {voice.isSupported && (
                          <div className="mt-3 flex justify-between items-center">
                            <button
                              onClick={() => { console.log('[CHAT:SPEAK_MESSAGE]', { text: m.content.slice(0, 120) }); voice.speak(m.content); }}
                              title="Lire ce message"
                              className={cn(
                                'p-1.5 hover:bg-primary/10 rounded-sm flex items-center gap-1 transition-opacity',
                                isCurrentlySpeaking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              )}
                            >
                              <Volume2 className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
                            </button>
                            {m.provider && (
                              <Badge variant="outline" className="text-[8px] bg-background font-code border-primary/30 py-0.5 uppercase text-primary">
                                {m.provider}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* ── Voice Status Bar ──────────────────────────────── */}
            <div className="px-1 flex flex-col gap-1.5 shrink-0">
              {/* TTS speaking indicator with controls */}
              {voice.isSpeaking && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-sm bg-secondary/5 border border-secondary/20">
                  <div className="flex items-center gap-2 shrink-0">
                    <Volume2 className="w-3 h-3 text-secondary animate-pulse" />
                    <span className="text-[8px] font-code text-secondary uppercase font-bold tracking-wider">
                      Synthèse Vocale
                    </span>
                  </div>
                  <div className="flex-1">
                    <VoiceWaveform volume={voice.isPaused ? 0.1 : 0.6} active={!voice.isPaused} color="secondary" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {voice.isPaused ? (
                      <button
                        onClick={() => voice.resume?.()}
                        title="Reprendre la lecture"
                        className="h-6 w-6 flex items-center justify-center rounded-sm bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        onClick={() => voice.pause?.()}
                        title="Mettre en pause"
                        className="h-6 w-6 flex items-center justify-center rounded-sm bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                      >
                        <Pause className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => { voice.cancel?.(); setAutoSpeak(false); }}
                      title="Arrêter la synthèse"
                      className="h-6 w-6 flex items-center justify-center rounded-sm bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <VolumeX className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Listening indicator + interim transcript + countdown */}
              {voice.isListening && !voice.isSpeaking && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-sm bg-red-500/5 border border-red-500/20">
                    {/* Status label */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                      <span className="text-[8px] font-code text-red-400 uppercase font-bold tracking-wider">
                        Écoute Active
                      </span>
                    </div>

                    {/* Waveform */}
                    <div className="flex-1">
                      <VoiceWaveform volume={voice.volume} active={voice.isListening && !voice.isSpeaking} color="red" />
                    </div>

                     {/* Countdown ring — shown when auto-send is pending */}
                     {countdown !== null && (
                       <div className="shrink-0 flex items-center gap-1">
                         <CountdownRing seconds={countdown} total={3} onCancel={clearCountdown} />
                       </div>
                     )}
                  </div>

                  {/* Interim transcript preview */}
                  {voice.interimTranscript && (
                    <div className="px-3 py-1.5 rounded-sm bg-primary/5 border border-primary/15 flex items-center gap-2">
                      <Activity className="w-2.5 h-2.5 text-primary shrink-0 animate-pulse" />
                      <span className="font-code text-[10px] text-primary/80 italic truncate">
                        {voice.interimTranscript}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Error display */}
              {voice.error && !voice.isListening && (
                <div className="px-3 py-1.5 rounded-sm bg-destructive/5 border border-destructive/20 flex items-center gap-2">
                  <span className="text-[10px] font-code text-destructive">
                    ⚠ {voice.error}
                  </span>
                </div>
              )}
            </div>

            {/* ── Input Bar ────────────────────────────────────── */}
            <Card className="p-1.5 sm:p-2 border-primary/20 bg-black/60 shadow-2xl shrink-0 glass-soft">
              <form onSubmit={handleManualSubmit} className="flex gap-2 items-center">

                {/* Mic button — 3 states */}
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!voice.isSupported || isLoading}
                  title={
                    micState === 'blocked' ? 'IA en cours de parole...'
                    : micState === 'listening' ? 'Arrêter le microphone'
                    : 'Activer le microphone'
                  }
                  className={cn(
                    'relative h-9 w-9 sm:h-10 sm:w-10 rounded-sm flex items-center justify-center shrink-0 transition-all duration-200',
                    micState === 'listening'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_12px_-2px_hsl(0_84%_60%/0.4)]'
                      : micState === 'blocked'
                      ? 'bg-muted/20 text-muted-foreground border border-border/30 opacity-50 cursor-not-allowed'
                      : 'text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30'
                  )}
                >
                  {/* Pulse ring when listening */}
                  {micState === 'listening' && (
                    <span className="absolute inset-0 rounded-sm animate-ping bg-red-500/20 pointer-events-none" />
                  )}
                  {micState === 'listening'
                    ? <MicOff className="w-4 h-4 relative z-10" />
                    : micState === 'blocked'
                    ? <VolumeX className="w-4 h-4" />
                    : <Mic className="w-4 h-4" />
                  }
                </button>

                {/* Audio toggle — always visible in input */}
                <button
                  type="button"
                  onClick={toggleAudio}
                  title={
                    voice.isSpeaking
                      ? 'Arrêter la lecture'
                      : autoSpeak
                      ? 'Désactiver audio automatique'
                      : 'Activer audio automatique'
                  }
                  className={cn(
                    'h-9 w-9 sm:h-10 sm:w-10 rounded-sm flex items-center justify-center shrink-0 transition-all duration-200 border',
                    voice.isSpeaking
                      ? 'bg-secondary/10 border-secondary/40 text-secondary animate-pulse'
                      : autoSpeak
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  {voice.isSpeaking
                    ? <VolumeX className="w-4 h-4" />
                    : autoSpeak
                    ? <Volume2 className="w-4 h-4" />
                    : <VolumeX className="w-4 h-4" />
                  }
                </button>

                {/* Input field */}
                <div className="flex-1 relative">
                  <Input
                    value={input}
                    data-voice-input="true"
                    onChange={(e) => {
                      clearCountdown();
                      setInput(e.target.value);
                      inputRef.current = e.target.value;
                      if (e.target.value.trim()) setIsVoiceInput(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') clearCountdown();
                    }}
                    placeholder={
                      voice.isListening
                        ? (voice.interimTranscript ? '' : 'En écoute...')
                        : isLoading
                        ? 'Réflexion en cours...'
                        : detectedCommand
                        ? `Commande détectée: ${detectedCommand}...`
                        : 'Commande système ou vocale...'
                    }
                    className={cn(
                      'flex-1 bg-transparent border-none focus-visible:ring-0 font-code uppercase text-xs sm:text-sm h-9 sm:h-10 transition-colors pr-2',
                      isVoiceInput && input ? 'text-primary' : '',
                      voice.isListening && 'text-red-400'
                    )}
                    disabled={isLoading || voice.isSpeaking}
                  />
                  
                  {/* Detected command badge */}
                  {detectedCommand && (
                    <div className="absolute -top-6 left-0 flex items-center gap-1.5">
                      <Command className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-code text-primary uppercase font-bold tracking-wider">
                        {detectedCommand}
                      </span>
                    </div>
                  )}
                </div>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || voice.isSpeaking}
                  className={cn(
                    'h-9 w-9 sm:h-10 sm:w-10 rounded-sm flex items-center justify-center shrink-0 transition-all duration-200',
                    isLoading || !input.trim() || voice.isSpeaking
                      ? 'bg-primary/20 text-primary/40 cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_14px_-3px_hsl(191_70%_56%/0.5)]'
                  )}
                >
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </form>
            </Card>
          </div>

          {/* ── Right Sidebar ──────────────────────────────────── */}
          <aside className="w-64 space-y-4 hidden xl:flex flex-col h-full overflow-y-auto terminal-scroll shrink-0">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2 shrink-0">
              Liaison RAG
            </h3>

            {/* RAG Status Card */}
            <Card className="p-4 border-secondary/20 bg-secondary/5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[9px] font-code font-bold text-secondary uppercase">Moteur Multimedia</span>
              </div>
              <p className="text-[8px] font-code text-muted-foreground leading-tight uppercase">
                &gt; Indexation : Items + Bank<br />
                &gt; Mode : Mains Libres<br />
                &gt; Statut : Opérationnel
              </p>
            </Card>

            {/* Voice status panel */}
            {voice.isSupported && (
              <Card className={cn(
                'p-3 border transition-colors',
                voice.isListening
                  ? 'border-red-500/30 bg-red-500/5'
                  : voice.isSpeaking
                  ? 'border-secondary/30 bg-secondary/5'
                  : 'border-border/40 bg-card/30'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Mic className={cn('w-3 h-3', voice.isListening ? 'text-red-400' : 'text-muted-foreground')} />
                  <span className="text-[9px] font-code font-bold text-muted-foreground uppercase">
                    Système Vocal
                  </span>
                </div>
                <div className="space-y-1 text-[8px] font-code text-muted-foreground uppercase">
                  <div className="flex justify-between">
                    <span>STT</span>
                    <span className={voice.isListening ? 'text-red-400' : 'text-muted-foreground/50'}>
                      {voice.isListening ? '● Actif' : '○ Veille'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>TTS</span>
                    <span className={cn(
                      voice.isSpeaking ? 'text-secondary' : autoSpeak ? 'text-primary' : 'text-muted-foreground/50',
                      voice.isPaused && 'text-yellow-500'
                    )}>
                      {voice.isSpeaking ? (voice.isPaused ? '⏸ Pause' : '● Parole') : autoSpeak ? '◉ Auto' : '○ Muet'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-Send</span>
                    <span className={countdown !== null ? 'text-primary' : 'text-muted-foreground/50'}>
                      {countdown !== null ? `${Math.ceil(countdown)}s` : '○ —'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume</span>
                    <span className={cn(voice.volume > 0.1 ? 'text-primary' : 'text-muted-foreground/50')}>
                      {voice.volume > 0.1 ? '● Détecté' : '○ —'}
                    </span>
                  </div>
                  {voice.error && (
                    <div className="mt-1 text-destructive">⚠ {voice.error}</div>
                  )}
                </div>
              </Card>
            )}

            <ConnectionStatus service="GROQ" label="Moteur LPU" />
            <ConnectionStatus service="FIREBASE" label="Base d'Audit" />
          </aside>
        </div>
      </main>
    </div>
  );
}
