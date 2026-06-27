"use client";

import { useState, useRef, useEffect } from 'react';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
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
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// ✅ CORRECTION 1 : Forcer le rendu dynamique

// ✅ CORRECTION 2 : Optionnel - Désactiver le pré-rendu statique

export default function BankPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedData, setCapturedData] = useState<string | null>(null);
  
  const [assetName, setAssetName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSyncing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !capturedData) {
      startCamera();
    }
    return () => stopCamera();
  }, [mounted, capturedData]);

  const startCamera = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Accès Caméra Refusé", description: "L'accès caméra n'est pas disponible sur ce navigateur.", variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: mode === 'video' 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast({ title: "Accès Caméra Refusé", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
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
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
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
        toast({ title: "Actif enregistré dans le Registre" });
        router.push('/bdd');
      } else {
        throw new Error(res.error || "Erreur de sauvegarde");
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden w-10" />
            <ImageIcon className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Banque d'Images Industrielle</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-[10px] uppercase font-code">
            <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Retour
          </Button>
        </header>

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
              <div className="flex justify-center gap-4">
                <div className="flex bg-muted/30 p-1 rounded-sm border border-border">
                  <button onClick={() => setMode('image')} className={cn("px-4 py-2 text-[10px] font-bold uppercase rounded-sm transition-all", mode === 'image' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}>Photo</button>
                  <button onClick={() => setMode('video')} className={cn("px-4 py-2 text-[10px] font-bold uppercase rounded-sm transition-all", mode === 'video' ? "bg-secondary text-secondary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}>Vidéo</button>
                </div>
                {mode === 'image' ? (
                  <Button onClick={takePhoto} className="px-8 bg-primary text-primary-foreground font-bold uppercase text-[10px] h-10 shadow-xl">
                    <Camera className="w-4 h-4 mr-2" /> Capturer
                  </Button>
                ) : (
                  !isCapturing ? (
                    <Button onClick={startRecording} className="px-8 bg-red-600 text-white font-bold uppercase text-[10px] h-10 shadow-xl">
                      <VideoIcon className="w-4 h-4 mr-2" /> Enregistrer
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} className="px-8 bg-white text-black font-bold uppercase text-[10px] h-10 shadow-xl animate-pulse">
                      Stopper
                    </Button>
                  )
                )}
              </div>
            )}
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
      </main>
    </div>
  );
}

