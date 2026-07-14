"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Video,
  Upload,
  Trash2,
  Image as ImageIcon,
  X,
  Square,
  Circle,
} from "lucide-react";
import { ProcedureMedia, MediaKind } from "@/lib/procedures/types";
import { useToast } from "@/hooks/use-toast";

interface MediaCaptureFieldProps {
  media: ProcedureMedia[];
  onChange: (media: ProcedureMedia[]) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo
const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

let mediaCounter = 0;
const nextMediaId = () => `media-${Date.now()}-${mediaCounter++}`;

export function MediaCaptureField({ media, onChange }: MediaCaptureFieldProps) {
  const { toast } = useToast();
  const [captureMode, setCaptureMode] = useState<MediaKind | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    setElapsed(0);
  }, [stream]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(
    async (kind: MediaKind) => {
      try {
        const constraints: MediaStreamConstraints =
          kind === "video"
            ? { video: true, audio: true }
            : { video: { facingMode: "environment" }, audio: false };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(s);
        setCaptureMode(kind);
        setRecordedUrl(null);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Caméra indisponible",
          description: e?.message || "Accès caméra/micro refusé ou non supporté.",
        });
        setCaptureMode(null);
      }
    },
    [toast]
  );

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const item: ProcedureMedia = {
          id: nextMediaId(),
          kind: "image",
          source: "capture",
          title: `Capture ${media.length + 1}`,
          url,
          thumbnailUrl: url,
          mimeType: blob.type || "image/png",
          fileSize: blob.size,
          createdAt: new Date().toISOString(),
          file: new File([blob], `capture-${Date.now()}.png`, { type: blob.type }),
        };
        onChange([...media, item]);
        stopStream();
        setCaptureMode(null);
        toast({ title: "Image capturée", description: item.title });
      },
      "image/png"
    );
  }, [media, onChange, stopStream, toast]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    try {
      const mimeCandidates = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        const item: ProcedureMedia = {
          id: nextMediaId(),
          kind: "video",
          source: "capture",
          title: `Enregistrement ${media.length + 1}`,
          url,
          mimeType: blob.type || "video/webm",
          fileSize: blob.size,
          duration: elapsed,
          createdAt: new Date().toISOString(),
          file: new File([blob], `recording-${Date.now()}.webm`, { type: blob.type }),
        };
        onChange([...media, item]);
        stopStream();
        setCaptureMode(null);
        toast({ title: "Vidéo enregistrée", description: item.title });
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Enregistrement impossible", description: e?.message });
    }
  }, [stream, media, onChange, stopStream, elapsed, toast]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const added: ProcedureMedia[] = [];
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          toast({ variant: "destructive", title: "Format non supporté", description: file.name });
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast({ variant: "destructive", title: "Fichier trop volumineux", description: `${file.name} (> 50 Mo)` });
          return;
        }
        const isImage = file.type.startsWith("image/");
        const url = URL.createObjectURL(file);
        added.push({
          id: nextMediaId(),
          kind: isImage ? "image" : "video",
          source: "upload",
          title: file.name.replace(/\.[^.]+$/, ""),
          url,
          thumbnailUrl: isImage ? url : undefined,
          mimeType: file.type,
          fileSize: file.size,
          createdAt: new Date().toISOString(),
          file,
        });
      });
      if (added.length > 0) {
        onChange([...media, ...added]);
        toast({ title: `${added.length} média(s) ajouté(s)` });
      }
    },
    [media, onChange, toast]
  );

  const removeMedia = useCallback(
    (id: string) => {
      const target = media.find((m) => m.id === id);
      if (target?.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
      onChange(media.filter((m) => m.id !== id));
    },
    [media, onChange]
  );

  const updateMeta = useCallback(
    (id: string, patch: Partial<ProcedureMedia>) => {
      onChange(media.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [media, onChange]
  );

  const fmtSize = (b?: number) =>
    b ? `${(b / 1024 / 1024).toFixed(1)} Mo` : "";
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
        <Camera className="w-4 h-4 text-primary" />
        <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Médias de référence</h3>
        <span className="text-tiny font-code text-muted-foreground/70 ml-1">
          (capturer / uploader pour réutilisation dans la séquence)
        </span>
      </div>

      {/* Mode capturing */}
      {captureMode && (
        <Card className="p-4 bg-black/40 border border-primary/30 space-y-3">
          <div className="relative rounded overflow-hidden bg-black aspect-video flex items-center justify-center">
            {recordedUrl ? (
              <video src={recordedUrl} className="w-full h-full object-contain" controls />
            ) : (
              <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
            )}
            {recording && (
              <span className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded text-tiny font-code text-destructive">
                <Circle className="w-2.5 h-2.5 fill-destructive animate-pulse" /> {fmtTime(elapsed)}
              </span>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex items-center justify-center gap-3">
            {captureMode === "image" && !recording && (
              <Button onClick={capturePhoto} className="bg-primary text-primary-foreground font-bold uppercase text-[11px]">
                <Camera className="w-4 h-4 mr-2" /> Capturer la photo
              </Button>
            )}
            {captureMode === "video" && !recording && !recordedUrl && (
              <Button onClick={startRecording} variant="destructive" className="font-bold uppercase text-[11px]">
                <Circle className="w-4 h-4 mr-2 fill-current" /> Démarrer
              </Button>
            )}
            {captureMode === "video" && recording && (
              <Button onClick={stopRecording} variant="destructive" className="font-bold uppercase text-[11px]">
                <Square className="w-4 h-4 mr-2" /> Arrêter
              </Button>
            )}
            <Button variant="outline" onClick={() => { stopStream(); setCaptureMode(null); setRecordedUrl(null); }} className="font-bold uppercase text-[11px]">
              <X className="w-4 h-4 mr-2" /> Annuler
            </Button>
          </div>
        </Card>
      )}

      {/* Barre d'actions */}
      {!captureMode && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => startCamera("image")} variant="outline" className="h-9 text-tiny uppercase font-bold border-primary/40">
            <Camera className="w-4 h-4 mr-2 text-primary" /> Capturer une image
          </Button>
          <Button type="button" onClick={() => startCamera("video")} variant="outline" className="h-9 text-tiny uppercase font-bold border-primary/40">
            <Video className="w-4 h-4 mr-2 text-primary" /> Enregistrer une vidéo
          </Button>
          <Button type="button" onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 text-tiny uppercase font-bold border-border">
            <Upload className="w-4 h-4 mr-2" /> Uploader un fichier
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {/* Bibliothèque */}
      {media.length === 0 ? (
        <div className="py-8 border-2 border-dashed border-border/30 rounded-lg flex flex-col items-center justify-center text-center opacity-40">
          <ImageIcon className="w-10 h-10 mb-3 text-muted-foreground" />
          <p className="font-code text-tiny uppercase tracking-widest">Aucun média. Capturez ou uploadez une image / vidéo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {media.map((m) => (
            <Card key={m.id} className="p-2 bg-card/30 border-border overflow-hidden group">
              <div className="relative aspect-video rounded overflow-hidden bg-black flex items-center justify-center">
                {m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                ) : (
                  <video src={m.url} className="w-full h-full object-cover" muted />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(m.id)}
                  className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded bg-black/70 text-destructive hover:bg-destructive hover:text-white transition"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Badge variant="outline" className="absolute bottom-1 left-1 text-micro font-code border-border bg-black/60">
                  {m.kind === "image" ? <ImageIcon className="w-3 h-3 mr-1" /> : <Video className="w-3 h-3 mr-1" />}
                  {m.source === "capture" ? "capture" : "upload"}
                </Badge>
              </div>
              <div className="pt-2 space-y-1.5">
                <Input
                  value={m.title}
                  onChange={(e) => updateMeta(m.id, { title: e.target.value })}
                  className="h-7 bg-black/40 border-border font-code text-[10px] uppercase"
                  placeholder="Libellé"
                />
                <Input
                  value={m.description || ""}
                  onChange={(e) => updateMeta(m.id, { description: e.target.value })}
                  className="h-7 bg-black/40 border-border font-code text-[10px]"
                  placeholder="Description (optionnel)"
                />
                <div className="flex items-center justify-between text-micro font-code text-muted-foreground/70 px-1">
                  <span>{fmtSize(m.fileSize)}</span>
                  {m.kind === "video" && m.duration ? <span>{fmtTime(m.duration)}</span> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
