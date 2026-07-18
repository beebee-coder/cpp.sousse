"use client";

import { useState, useRef, useEffect } from 'react';
import { 
  Camera,
  Video as VideoIcon, 
  Save, 
  Trash2, 
  Info, 
  Loader2, 
  FileJson,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  FlipHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/hooks/use-app-mode';

// ✅ CORRECTION 1 : Forcer le rendu dynamique

// ✅ CORRECTION 2 : Optionnel - Désactiver le pré-rendu statique

export default function BankPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { localOnly } = useAppMode();
  
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedData, setCapturedData] = useState<string | null>(null);
  
  const [assetName, setAssetName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSyncing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameras, setCameras] = useState<{ deviceId?: string; label?: string; facingMode?: string }[]>([]);

  const [view, setView] = useState<'capture' | 'library'>('capture');
  const [assets, setAssets] = useState<any[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const loadLibrary = async () => {
    setLoadingLibrary(true);
    try {
      // Tous les modes (web / hybride / locale) : la bibliothèque est servie
      // par l'API. En mode locale/desktop offline, l'intercepteur /api/bank
      // lit le miroir .local-db/.registry (aucun appel cloud).
      const res = await apiClient.get<any>('/api/bank?limit=200');
      const items: any[] = res.items || [];
      setAssets(items);
      // Miniatures : URL cloud directe, sinon binaire servi par le Registre local.
      const map: Record<string, string> = {};
      await Promise.all(items.map(async (it) => {
        if (it.url) { map[it.name] = it.url; return; }
        if (it.path) {
          try {
            const r = await apiClient.get<any>(`/api/registry?path=${encodeURIComponent(it.path)}`);
            if (r.success && r.content) map[it.name] = r.content;
          } catch { /* ignore */ }
        }
      }));
      setThumbs(map);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (view === 'library') loadLibrary();
  }, [view]);

  const handleDelete = async (name: string) => {
    setDeletingName(name);
    try {
      const res = await apiClient.delete<any>(`/api/bank?name=${encodeURIComponent(name)}`);
      if (res.success) {
        toast({ title: 'Actif supprimé de la banque et du RAG' });
        await loadLibrary();
      } else {
        throw new Error((res.error as string) || 'ECHEC_SUPPRESSION');
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingName(null);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recMimeRef = useRef<string>('video/webm');
  const chunksRef = useRef<Blob[]>([]);

  // Choix d'un type MIME réellement supporté par MediaRecorder (Safari→mp4,
  // Chrome/Firefox→webm) afin de ne pas forcer un conteneur incohérent avec
  // les bytes réellement produits (ex: webm étiqueté video/mp4).
  const pickRecorderMime = (): string => {
    if (typeof MediaRecorder === 'undefined') return 'video/webm';
    const candidates = ['video/mp4', 'video/webm', 'video/quicktime'];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch {
        // ignore
      }
    }
    return 'video/webm';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setMode(isVideo ? 'video' : 'image');
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedData(reader.result as string);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !capturedData) {
      startCamera();
    }
    return () => stopCamera();
  }, [mounted, capturedData]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Caméra ${d.deviceId.slice(0, 8)}`,
          facingMode: (d as any).facingMode,
        }));
      setCameras(videoDevices);
    } catch {
      // ignore
    }
  };

  const startCamera = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Accès Caméra Refusé", description: "L'accès caméra n'est pas disponible sur ce navigateur.", variant: "destructive" });
      return;
    }

    await enumerateCameras();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode,
        },
        audio: mode === 'video',
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast({ title: "Accès Caméra Refusé", variant: "destructive" });
    }
  };

  const switchCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    stopCamera();
    await startCamera();
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedData(data);
    stopCamera();
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = pickRecorderMime();
    recMimeRef.current = mimeType;
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recMimeRef.current || 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => setCapturedData(reader.result as string);
      reader.readAsDataURL(blob);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsCapturing(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsCapturing(false);
      stopCamera();
    }
  };

  const BANK_ERRORS: Record<string, string> = {
    NON_AUTHENTIFIÉ: "Session expirée. Reconnectez-vous.",
    DONNEES_MANQUANTES: "Nom et capture requis.",
    TYPE_INVALIDE: "Type d'actif invalide (image/vidéo).",
    FORMAT_ATTENDU_DATA_URI: "Données binaires illisibles.",
    MIME_NON_SUPPORTE: "Format de fichier non supporté.",
    TYPE_INCOHÉRENT_IMAGE: "Le fichier n'est pas une image.",
    TYPE_INCOHÉRENT_VIDEO: "Le fichier n'est pas une vidéo.",
    DEPASSEMENT_TAILLE: "Fichier trop volumineux (max 50 Mo).",
    NOM_INVALIDE: "Nom d'actif invalide.",
    ACTIF_EXISTANT: "Un actif porte déjà ce nom. Renommez-le.",
    BANK_WRITE_CLOUD_UNSUPPORTED: "Sauvegarde cloud indisponible (stockage non configuré).",
    BANK_SAVE_FAILED: "Échec de l'enregistrement local.",
    BANK_SAVE_CLOUD_FAILED: "Échec de l'enregistrement cloud.",
  };

  const handleSave = async () => {
    if (!assetName.trim() || !capturedData) return;
    setIsSyncing(true);
    try {
      const res = await apiClient.post<any>('/api/bank', {
        name: assetName,
        type: mode,
        data: capturedData,
        metadata: {
          description,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          author: 'admin',
          source: 'VisioNode Bank'
        }
      });

      if (res.success) {
        toast({
          title: res.offline ? "Actif enregistré (mode local)" : "Actif enregistré dans le Registre",
          description: res.offline ? "Sauvegardé dans .registry/bank et indexé pour la recherche RAG." : undefined,
        });
        router.push('/bdd');
      } else {
        const code = (res.error as string) || "ERREUR_INCONNUE";
        throw new Error(BANK_ERRORS[code] || code);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <ImageIcon className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Banque d'Images Industrielle</span>
            {localOnly && (
              <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-sm bg-secondary/15 text-secondary text-[8px] font-bold uppercase border border-secondary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> Mode Local
              </span>
            )}
            <div className="hidden sm:flex bg-muted/30 p-1 rounded-sm border border-border ml-2">
              <button onClick={() => setView('capture')} className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-sm transition-all", view === 'capture' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>Capturer</button>
              <button onClick={() => setView('library')} className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-sm transition-all", view === 'library' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>Bibliothèque</button>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] uppercase font-code">
            <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Retour
          </Button>
          <Button variant="ghost" size="sm" onClick={() => loadLibrary()} disabled={loadingLibrary} className="text-[10px] uppercase font-code">
            <Loader2 className={cn("w-3.5 h-3.5 mr-2", loadingLibrary && "animate-spin")} /> Actualiser
          </Button>
        </header>

        {view === 'library' ? (
          <div className="p-4 lg:p-8 max-w-6xl mx-auto w-full">
            {loadingLibrary ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-xs uppercase tracking-widest">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Chargement…
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-xs uppercase tracking-widest gap-2">
                <ImageIcon className="w-8 h-8 opacity-40" />
                {localOnly ? "Aucun actif local" : "Aucun actif dans la banque"}
                <span className="text-[9px] normal-case tracking-normal opacity-70">
                  {localOnly ? "Capturez une image ou vidéo pour l'enregistrer localement." : "Capturez ou uploadez un actif pour démarrer."}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {assets.map((a) => (
                  <Card key={a.name} className="overflow-hidden bg-card/40 border-border group">
                    <div className="aspect-video bg-black relative">
                      {thumbs[a.name] ? (
                        a.type === 'video' ? (
                          <video src={thumbs[a.name]} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={thumbs[a.name]} className="w-full h-full object-cover" alt={a.name} />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="w-6 h-6 opacity-30" />
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(a.name)}
                        disabled={deletingName === a.name}
                        className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-sm bg-red-600/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer"
                      >
                        {deletingName === a.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase text-primary truncate">{a.name}</span>
                        <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm shrink-0", a.type === 'video' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary')}>{a.type}</span>
                      </div>
                      {a.description ? <p className="text-[9px] text-muted-foreground line-clamp-2">{a.description}</p> : null}
                      {Array.isArray(a.tags) && a.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {a.tags.slice(0, 3).map((t: string, i: number) => (
                            <span key={i} className="text-[8px] uppercase px-1.5 py-0.5 rounded-sm bg-muted/40 text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 lg:p-8 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Capture Zone */}
          <div className="space-y-4">
            <Card className="aspect-video bg-black border-primary/20 overflow-hidden relative shadow-2xl">
              {!capturedData ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 pointer-events-none border-[1px] border-primary/10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
                  {isCapturing && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-sm animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full" />
                      <span className="text-[10px] font-bold text-white uppercase font-code">REC</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full relative">
                  {mode === 'image' ? (
                    <img src={capturedData} className="w-full h-full object-cover" />
                  ) : (
                    <video src={capturedData} controls className="w-full h-full object-cover" />
                  )}
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-4 right-4 h-8 w-8" 
                    onClick={() => { setCapturedData(null); startCamera(); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>

            {!capturedData && (
              <div className="flex justify-center gap-4 flex-wrap">
                <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
                  <button onClick={() => setMode('image')} className={cn("px-4 py-2 text-[10px] font-bold uppercase rounded-sm transition-all", mode === 'image' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}>Photo</button>
                  <button onClick={() => setMode('video')} className={cn("px-4 py-2 text-[10px] font-bold uppercase rounded-sm transition-all", mode === 'video' ? "bg-secondary text-secondary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}>Vidéo</button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={switchCamera}
                  className="h-10 text-[10px] uppercase font-code border-border"
                >
                  <FlipHorizontal className="w-4 h-4 mr-2" /> {facingMode === 'user' ? 'Avant' : 'Arrière'}
                </Button>
                {mode === 'image' ? (
                  <div className="flex gap-2">
                    <Button onClick={takePhoto} className="px-8 bg-primary text-primary-foreground font-bold uppercase text-[10px] h-10 shadow-xl">
                      <Camera className="w-4 h-4 mr-2" /> Capturer
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} className="px-6 bg-secondary text-secondary-foreground font-bold uppercase text-[10px] h-10 shadow-xl">
                      <Upload className="w-4 h-4 mr-2" /> Upload
                    </Button>
                  </div>
                ) : (
                  !isCapturing ? (
                    <div className="flex gap-2">
                      <Button onClick={startRecording} className="px-8 bg-red-600 text-white font-bold uppercase text-[10px] h-10 shadow-xl">
                        <VideoIcon className="w-4 h-4 mr-2" /> Enregistrer
                      </Button>
                      <Button onClick={() => fileInputRef.current?.click()} className="px-6 bg-secondary text-secondary-foreground font-bold uppercase text-[10px] h-10 shadow-xl">
                        <Upload className="w-4 h-4 mr-2" /> Upload
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={stopRecording} className="px-8 bg-white text-black font-bold uppercase text-[10px] h-10 shadow-xl animate-pulse">
                      Stopper
                    </Button>
                  )
                )}
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*,video/*" 
              className="hidden" 
            />
          </div>

          {/* Form Zone */}
          <div className="space-y-6">
            <Card className="p-6 border-border bg-card/40 space-y-6 shadow-xl">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-primary tracking-widest block mb-2">Identification de l'Actif</label>
                  <Input 
                    placeholder="EX: POMPE_EST_V01" 
                    value={assetName} 
                    onChange={e => setAssetName(e.target.value)}
                    className="bg-black/40 font-code uppercase text-sm h-12 border-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block mb-2">Description Technique</label>
                  <Textarea 
                    placeholder="Détails du composant ou de l'anomalie..." 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="bg-black/40 font-code text-xs h-32 border-border/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block mb-2">Tags (séparés par virgules)</label>
                  <Input 
                    placeholder="maintenance, p01, alerte" 
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    className="bg-black/40 font-code text-xs h-10 border-border/50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border/30">
                <div className="flex items-start gap-3 p-3 bg-secondary/5 border border-secondary/20 rounded-sm mb-6">
                  <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <p className="text-[9px] font-code text-muted-foreground uppercase leading-tight">
                    L'actif sera stocké dans <span className="text-secondary font-bold">.registry/bank/{assetName || '...'}</span> avec un fichier <span className="text-primary font-bold">metadata.json</span> éditable.
                  </p>
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !capturedData || !assetName.trim()}
                  className="w-full h-12 bg-primary text-primary-foreground font-bold uppercase text-xs shadow-[0_0_20px_rgba(50,181,212,0.3)] transition-all hover:scale-[1.01]"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Sauvegarder dans le Registre Physique
                </Button>
              </div>
            </Card>

            <Card className="p-4 bg-black/40 border-border">
              <div className="flex items-center gap-2 mb-2">
                <FileJson className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[10px] font-bold uppercase text-secondary">Aperçu Métadonnées</span>
              </div>
              <pre className="text-[9px] font-code text-muted-foreground opacity-50 overflow-hidden line-clamp-4">
                {`{
  "name": "${assetName || '...'}",
  "type": "${mode}",
  "description": "${description || '...'}",
  "tags": [${tags.split(',').map(t => `"${t.trim()}"`).join(', ')}],
  "created_at": "${new Date().toISOString()}"
}`}
              </pre>
            </Card>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}

