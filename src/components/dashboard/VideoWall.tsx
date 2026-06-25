
"use client";

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Activity, Radio, Clock, ShieldCheck } from 'lucide-react';

interface StreamProps {
  label: string;
  isLocal?: boolean;
  isVideoOff?: boolean;
  placeholderSeed: string;
}

function StreamCard({ label, isLocal, isVideoOff, placeholderSeed }: StreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLocal && !isVideoOff) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(s => {
          setStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.warn("Caméra indisponible:", err));
    } else {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
    }
  }, [isLocal, isVideoOff]);

  return (
    <div className="relative aspect-video bg-black rounded-sm border border-primary/20 overflow-hidden group shadow-2xl">
      {/* Background/Video Layer */}
      {isLocal && !isVideoOff ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover opacity-80 mirror scale-x-[-1]" 
        />
      ) : isVideoOff && isLocal ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/5">
           <Camera className="w-12 h-12 text-muted-foreground/20 mb-3" />
           <span className="text-[9px] font-code text-muted-foreground uppercase tracking-widest">Flux Local Désactivé</span>
        </div>
      ) : (
        <div className="w-full h-full relative">
           <img 
            src={`https://picsum.photos/seed/${placeholderSeed}/640/360`} 
            className="w-full h-full object-cover opacity-40 grayscale" 
            alt={label}
           />
           <div className="absolute inset-0 bg-primary/5 mix-blend-overlay" />
        </div>
      )}

      {/* Industrial Overlay (HUD) */}
      <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isLocal ? "bg-primary" : "bg-secondary"
            )} />
            <span className="text-[10px] font-code font-bold uppercase tracking-widest text-white/90 drop-shadow-md">
              {isLocal ? "STATION_LOCALE" : label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/40 border border-white/10 rounded-sm">
            <Radio className="w-3 h-3 text-secondary" />
            <span className="text-[8px] font-code text-secondary font-bold uppercase">LIVE</span>
          </div>
        </div>

        <div className="flex justify-between items-end opacity-60">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-[8px] font-code text-white uppercase">{isLocal ? "LINK_STABLE" : "REMOTE_LINK"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-white" />
            <span className="text-[8px] font-code text-white">{time}</span>
          </div>
        </div>
      </div>

      {/* Visual FX Layers */}
      <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] opacity-20" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]" />
      
      {/* User Status Badge */}
      <div className="absolute bottom-4 left-4 bg-primary/10 border border-primary/30 px-2 py-1 backdrop-blur-sm transition-transform group-hover:scale-105">
         <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-[8px] font-code text-primary uppercase font-bold">Audit Actif</span>
         </div>
      </div>
    </div>
  );
}

export function VideoWall({ isLocalVideoOff }: { isLocalVideoOff: boolean }) {
  const remoteStreams = [
    { label: "ZONE_EST_V01", seed: "industry1" },
    { label: "QUAI_LOGISTIQUE", seed: "factory2" },
    { label: "LABO_CONTROLE", seed: "lab3" },
    { label: "LIGNE_ASSEMBLAGE", seed: "robot4" },
    { label: "POSTE_RECEPTION", seed: "office5" },
  ];

  return (
    <div className="h-full w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto terminal-scroll pr-2">
      {/* Le flux local est toujours en premier */}
      <StreamCard 
        label="LOCAL" 
        isLocal={true} 
        isVideoOff={isLocalVideoOff} 
        placeholderSeed="local" 
      />

      {/* Les flux distants simulés */}
      {remoteStreams.map((stream, idx) => (
        <StreamCard 
          key={stream.label} 
          label={stream.label} 
          placeholderSeed={stream.seed} 
        />
      ))}
    </div>
  );
}
