"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Activity, Radio, Clock, Wifi, Video, Signal, UserX } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemoteUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}

interface PeerState {
  peerId: string;
  stream: MediaStream;
  bitrate: string;
  userId?: string;
  displayName?: string;
}

// ─── StreamCard ───────────────────────────────────────────────────────────────

interface StreamCardProps {
  label: string;
  isLocal?: boolean;
  isVideoOff?: boolean;
  streamOverride?: MediaStream | null;
  bitrateOverride?: string;
  isConnected?: boolean;
  userInfo?: string;
  devices?: MediaDeviceInfo[];
  selectedDeviceId?: string;
  onDeviceChange?: (deviceId: string) => void;
}

function StreamCard({
  label,
  isLocal,
  isVideoOff,
  streamOverride,
  bitrateOverride,
  isConnected = false,
  userInfo,
  devices = [],
  selectedDeviceId,
  onDeviceChange,
}: StreamCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState('');
  const [displayBitrate, setDisplayBitrate] = useState('0.0');

  // Horloge en direct
  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString('fr-FR'));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Débit simulé basé sur l'activité réelle de la caméra
  useEffect(() => {
    if (bitrateOverride) {
      setDisplayBitrate(bitrateOverride);
      return;
    }
    if (streamOverride && !isVideoOff) {
      const base = (Math.random() * 1.5 + 1.2).toFixed(1);
      setDisplayBitrate(base);
      const jitter = setInterval(() => {
        setDisplayBitrate((parseFloat(base) + (Math.random() - 0.5) * 0.2).toFixed(1));
      }, 2000);
      return () => clearInterval(jitter);
    } else {
      setDisplayBitrate('0.0');
    }
  }, [bitrateOverride, streamOverride, isVideoOff]);

  // Attacher le flux au <video>
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = streamOverride || null;
    }
  }, [streamOverride]);

  const hasLiveVideo = !isVideoOff && !!streamOverride;

  return (
    <div className="relative aspect-video bg-[#020407] rounded-sm border border-primary/20 overflow-hidden group shadow-2xl transition-all hover:border-primary/50">
      {/* Sélecteur de caméra — STATION_MASTER uniquement */}
      {isLocal && devices.length > 1 && (
        <div className="absolute top-2 left-2 z-20 pointer-events-auto bg-black/80 border border-white/10 px-2 py-0.5 rounded-sm flex items-center gap-1.5 backdrop-blur-md">
          <Video className="w-2.5 h-2.5 text-primary shrink-0" />
          <select
            value={selectedDeviceId}
            onChange={(e) => onDeviceChange?.(e.target.value)}
            className="bg-transparent text-[8px] font-code text-white uppercase outline-none cursor-pointer max-w-[110px]"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId} className="bg-black text-white">
                {d.label ? d.label.split('(')[0].trim() : `CAM_${d.deviceId.slice(0, 4).toUpperCase()}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Layer principal ── */}
      {hasLiveVideo ? (
        /* Flux vidéo réel */
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      ) : isLocal && isVideoOff ? (
        /* Caméra locale coupée */
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <Camera className="w-10 h-10 text-muted-foreground/20" />
          <span className="text-[9px] font-code text-muted-foreground/50 uppercase tracking-widest">
            Flux Local Suspendu
          </span>
        </div>
      ) : isConnected ? (
        /* Pair connecté mais pas encore de flux vidéo */
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-primary/5">
          <Signal className="w-10 h-10 text-primary/40 animate-pulse" />
          <span className="text-[9px] font-code text-primary/60 uppercase tracking-widest">
            Négociation P2P…
          </span>
        </div>
      ) : (
        /* Slot vide — aucune caméra distante sur ce canal */
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <UserX className="w-8 h-8 text-muted-foreground/15" />
          <span className="text-[8px] font-code text-muted-foreground/30 uppercase tracking-widest text-center px-4">
            {userInfo ? `EN ATTENTE DE : ${userInfo}` : 'CANAL LIBRE — EN ATTENTE'}
          </span>
        </div>
      )}

      {/* ── HUD overlay ── */}
      <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
        {/* Ligne supérieure */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                hasLiveVideo ? 'bg-primary animate-pulse' : isConnected ? 'bg-yellow-400 animate-pulse' : 'bg-muted-foreground/30'
              )}
            />
            <span className="text-[10px] font-code font-bold uppercase tracking-widest text-white/90 drop-shadow">
              {label}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {hasLiveVideo && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600/80 border border-red-400/30 rounded-sm">
                <Radio className="w-3 h-3 text-white" />
                <span className="text-[8px] font-code text-white font-bold uppercase">LIVE</span>
              </div>
            )}
            <span className="text-[7px] font-code text-white/40 uppercase bg-black/40 px-1">
              {displayBitrate} Mbps
            </span>
          </div>
        </div>

        {/* Ligne inférieure */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Wifi className={cn('w-3 h-3', hasLiveVideo ? 'text-primary/70' : 'text-muted-foreground/30')} />
              <span className="text-[7px] font-code text-white/40 uppercase">
                {isLocal ? 'LIAISON_DIRECTE' : hasLiveVideo ? 'P2P_WEBRTC' : 'HORS_LIGNE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-white/20" />
              <span className="text-[7px] font-code text-white/30">{time}</span>
            </div>
          </div>
          <div className={cn('px-2 py-0.5 rounded-sm border', hasLiveVideo ? 'bg-primary/20 border-primary/40' : 'bg-muted/10 border-muted/20')}>
            <span className={cn('text-[7px] font-code font-bold uppercase', hasLiveVideo ? 'text-primary' : 'text-muted-foreground/40')}>
              {isLocal ? 'CH_01' : isConnected ? 'CH_P2P' : 'CH_OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.08)_50%)] bg-[length:100%_4px] opacity-30" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.7)]" />

      {/* Hover focus badge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-4 py-2 border border-primary/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-code text-primary uppercase font-bold tracking-widest">
            {hasLiveVideo ? 'Flux Actif' : 'Canal Inactif'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── VideoWall ────────────────────────────────────────────────────────────────

export function VideoWall({ isLocalVideoOff }: { isLocalVideoOff: boolean }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RemoteUser[]>([]);

  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);
  const myIdRef = useRef<string>('');
  // On garde une ref du stream local pour les closures WebRTC
  const localStreamRef = useRef<MediaStream | null>(null);

  // ── Charger les utilisateurs réels depuis la BDD ──────────────────────────
  useEffect(() => {
    apiClient.get<{ success: boolean; users: RemoteUser[] }>('/api/users')
      .then((res) => {
        if (res.success) setRegisteredUsers(res.users);
      })
      .catch(() => {});
  }, []);

  // ── Enumérer les caméras physiques ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const videoDevs = devs.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevs);
      if (videoDevs.length > 0) setSelectedDeviceId(videoDevs[0].deviceId);
    });
  }, []);

  // ── Démarrer la caméra locale ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isLocalVideoOff) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      return;
    }

    const constraints: MediaStreamConstraints = {
      video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: 1280, height: 720 }
        : { width: 1280, height: 720 },
      audio: false,
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((s) => {
        // Arrêter l'ancien flux avant d'en démarrer un nouveau
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = s;
        setLocalStream(s);

        // Remettre à jour les pistes sur les PeerConnections existantes
        Object.values(pcsRef.current).forEach((pc) => {
          pc.getSenders().forEach((sender) => pc.removeTrack(sender));
          s.getTracks().forEach((track) => pc.addTrack(track, s));
        });
      })
      .catch((err) => console.warn('[VideoWall] Caméra indisponible:', err));
  }, [selectedDeviceId, isLocalVideoOff]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Signalement WebRTC via BroadcastChannel ───────────────────────────────
  const cleanupPeer = useCallback((peerId: string) => {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
  }, []);

  const createPC = useCallback(
    (peerId: string, channel: BroadcastChannel) => {
      if (pcsRef.current[peerId]) return pcsRef.current[peerId];

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcsRef.current[peerId] = pc;

      // Ajouter le flux local courant (via ref pour éviter les stale closures)
      localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

      // Recevoir le flux vidéo distant → état réel
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteStream) return;
        setPeers((prev) => {
          const exists = prev.find((p) => p.peerId === peerId);
          if (exists) return prev.map((p) => p.peerId === peerId ? { ...p, stream: remoteStream } : p);
          return [...prev, { peerId, stream: remoteStream, bitrate: (Math.random() * 1.5 + 1.2).toFixed(1) }];
        });
      };

      // Candidats ICE
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.postMessage({ type: 'candidate', from: myIdRef.current, to: peerId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          cleanupPeer(peerId);
        }
      };

      return pc;
    },
    [cleanupPeer]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const myId = 'STA_' + Math.random().toString(36).substring(2, 7).toUpperCase();
    myIdRef.current = myId;

    const channel = new BroadcastChannel('visionode_video_wall');
    channelRef.current = channel;

    channel.onmessage = async ({ data }) => {
      const { type, from, to, sdp, candidate } = data;
      // Ignorer ses propres messages et les messages adressés à d'autres
      if (from === myId) return;
      if (to && to !== myId) return;

      if (type === 'join') {
        // Quelqu'un vient d'arriver : envoyer une offre
        const pc = createPC(from, channel);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.postMessage({ type: 'offer', from: myId, to: from, sdp: pc.localDescription });
      } else if (type === 'offer') {
        const pc = createPC(from, channel);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.postMessage({ type: 'answer', from: myId, to: from, sdp: pc.localDescription });
      } else if (type === 'answer') {
        const pc = pcsRef.current[from];
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } else if (type === 'candidate') {
        const pc = pcsRef.current[from];
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        }
      } else if (type === 'leave') {
        cleanupPeer(from);
      }
    };

    // S'annoncer aux pairs déjà présents
    channel.postMessage({ type: 'join', from: myId });

    return () => {
      channel.postMessage({ type: 'leave', from: myId });
      channel.close();
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
    };
  }, [createPC, cleanupPeer]);

  // ── Rendu ────────────────────────────────────────────────────────────────

  // Préparer jusqu'à 5 slots distants, enrichis avec les infos utilisateurs réels
  const MAX_REMOTE_SLOTS = 5;
  const remoteSlots = Array.from({ length: MAX_REMOTE_SLOTS }, (_, i) => {
    const activePeer = peers[i];
    const registeredUser = registeredUsers[i]; // Utilisateur réel de la BDD (hors admin courant)

    const userInfo = registeredUser
      ? `${registeredUser.firstName ?? ''} ${registeredUser.lastName ?? ''}`.trim() ||
        registeredUser.email.split('@')[0].toUpperCase()
      : undefined;

    const label = activePeer
      ? activePeer.peerId
      : registeredUser
      ? (userInfo ?? `USER_${i + 1}`)
      : `CANAL_${String(i + 1).padStart(2, '0')}`;

    return { activePeer, userInfo, label, slot: i };
  });

  return (
    <div className="h-full w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto terminal-scroll pr-2 pb-8">
      {/* ─── Flux local ─── */}
      <StreamCard
        label="STATION_MASTER"
        isLocal={true}
        isVideoOff={isLocalVideoOff}
        streamOverride={localStream}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
      />

      {/* ─── Flux distants : pairs WebRTC ou slots d'attente réels ─── */}
      {remoteSlots.map(({ activePeer, userInfo, label, slot }) =>
        activePeer ? (
          <StreamCard
            key={activePeer.peerId}
            label={label}
            isLocal={false}
            streamOverride={activePeer.stream}
            bitrateOverride={activePeer.bitrate}
            isConnected={true}
          />
        ) : (
          <StreamCard
            key={`slot_${slot}`}
            label={label}
            isLocal={false}
            streamOverride={null}
            isConnected={false}
            userInfo={userInfo}
          />
        )
      )}
    </div>
  );
}