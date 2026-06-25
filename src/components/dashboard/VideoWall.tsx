"use client";

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Activity, Radio, Clock, ShieldCheck, Wifi } from 'lucide-react';

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
  const [bitrate] = useState((Math.random() * 2 + 1.5).toFixed(1));

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLocal && !isVideoOff) {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
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
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isLocal, isVideoOff]);

  return (
    <div className="relative aspect-video bg-black rounded-sm border border-primary/20 overflow-hidden group shadow-2xl transition-all hover:border-primary/40">
      {/* Layer Vidéo / Image */}
      {isLocal && !isVideoOff ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover opacity-90 scale-x-[-1]" 
        />
      ) : isVideoOff && isLocal ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/5">
           <Camera className="w-12 h-12 text-muted-foreground/20 mb-3" />
           <span className="text-[9px] font-code text-muted-foreground uppercase tracking-widest">Flux Local Suspendu</span>
        </div>
      ) : (
        <div className="w-full h-full relative">
           <img 
            src={`https://picsum.photos/seed/${placeholderSeed}/640/360`} 
            className="w-full h-full object-cover opacity-50 grayscale" 
            alt={label}
           />
           <div className="absolute inset-0 bg-primary/5 mix-blend-overlay" />
        </div>
      )}

      {/* HUD de Surveillance */}
      <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isLocal ? "bg-primary" : "bg-secondary"
            )} />
            <span className="text-[10px] font-code font-bold uppercase tracking-widest text-white/90 drop-shadow-md">
              {isLocal ? "STATION_MASTER" : label}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/60 border border-white/10 rounded-sm">
              <Radio className="w-3 h-3 text-secondary" />
              <span className="text-[8px] font-code text-secondary font-bold uppercase">LIVE</span>
            </div>
            <span className="text-[7px] font-code text-white/40 uppercase bg-black/40 px-1">{bitrate} MBPS</span>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-primary opacity-60" />
                <span className="text-[8px] font-code text-white/60 uppercase">{isLocal ? "LIAISON_CRYPTÉE" : "DÉCRYPTAGE_P2P"}</span>
             </div>
             <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-white/40" />
                <span className="text-[8px] font-code text-white/40">{time}</span>
             </div>
          </div>
          <div className="bg-primary/20 border border-primary/40 px-2 py-0.5 rounded-sm">
             <span className="text-[8px] font-code text-primary font-bold uppercase">SEC_CH_0{placeholderSeed === 'local' ? '1' : Math.floor(Math.random() * 9)}</span>
          </div>
        </div>
      </div>

      {/* Effets Visuels (Overlay) */}
      <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />
      
      {/* Status Badge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-4 py-2 border border-primary/30 backdrop-blur-md">
         <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-code text-primary uppercase font-bold tracking-widest">Focus Terminal</span>
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
    <div className="h-full w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto terminal-scroll pr-2 pb-8">
      {/* Flux local */}
      <StreamCard 
        label="LOCAL" 
        isLocal={true} 
        isVideoOff={isLocalVideoOff} 
        placeholderSeed="local" 
      />

      {/* Flux distants */}
      {remoteStreams.map((stream) => (
        <StreamCard 
          key={stream.label} 
          label={stream.label} 
          placeholderSeed={stream.seed} 
        />
      ))}
    </div>
  );
}