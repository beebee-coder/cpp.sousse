"use client";

import { useState, useRef, useEffect } from 'react';
import { User, Camera, Upload, Trash2 } from 'lucide-react';

const MAX_DIM = 256;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeDataUrl(dataUrl: string, type = 'image/jpeg'): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(type, 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

interface ProfilePhotoMenuProps {
  currentImage?: string | null;
  onSave: (image: string | null) => void;
  size?: number;
}

export function ProfilePhotoMenu({ currentImage, onSave, size = 32 }: ProfilePhotoMenuProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const display = preview !== null ? preview : (currentImage ?? null);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      stopCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await fileToDataUrl(file);
    setPreview(await resizeDataUrl(raw));
    if (fileRef.current) fileRef.current.value = '';
  };

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCapturing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      /* accès caméra indisponible */
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || MAX_DIM;
    const h = video.videoHeight || MAX_DIM;
    const s = Math.min(w, h);
    const sx = (w - s) / 2;
    const sy = (h - s) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = MAX_DIM;
    canvas.height = MAX_DIM;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, sx, sy, s, s, 0, 0, MAX_DIM, MAX_DIM);
      setPreview(canvas.toDataURL('image/jpeg', 0.85));
    }
    stopCapture();
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturing(false);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(preview);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="glow-ring rounded-full p-0.5 block shrink-0"
        aria-label="Photo de profil"
      >
        <span
          className="rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 overflow-hidden block"
          style={{ width: size, height: size }}
        >
          {display ? (
            <img src={display} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="text-primary" style={{ width: size * 0.5, height: size * 0.5 }} />
          )}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50 rounded-lg border border-border bg-card/95 backdrop-blur-md p-4 shadow-glow">
          <div className="flex items-center gap-3">
            <span className="glow-ring rounded-full p-0.5">
              <span className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 overflow-hidden block">
                {display ? (
                  <img src={display} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-primary" />
                )}
              </span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-code">Photo de profil</span>
          </div>

          {capturing ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              <video ref={videoRef} className="w-full rounded-md border border-border aspect-square object-cover bg-black/40" muted playsInline />
              <div className="flex gap-2">
                <button onClick={takeSnapshot} className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase">Capturer</button>
                <button onClick={stopCapture} className="px-3 py-1.5 rounded-md border border-border text-xs uppercase">Annuler</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs uppercase hover:bg-muted/60 transition-colors">Importer</button>
              <button onClick={startCapture} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs uppercase hover:bg-muted/60 transition-colors">Capturer</button>
              {display && (
                <button onClick={() => setPreview('')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-destructive text-xs uppercase">Retirer</button>
              )}
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-md border border-border text-xs uppercase">Fermer</button>
            <button onClick={handleSave} disabled={busy} className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase disabled:opacity-50">
              {busy ? '...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
