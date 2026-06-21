
"use client";

import { useState, useEffect } from 'react';
import { Camera, RefreshCcw, Search, Cpu, Layers, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import Image from 'next/image';
import { VisionAssistantDescriptionOutput } from '@/ai/flows/vision-assistant-description';
import { VisualDocumentRetrievalOutput } from '@/ai/flows/visual-document-retrieval';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

export function VisionTerminal() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VisionAssistantDescriptionOutput | null>(null);
  const [docs, setDocs] = useState<VisualDocumentRetrievalOutput | null>(null);
  const [currentImage, setCurrentImage] = useState<string>("");

  useEffect(() => {
    if (Array.isArray(PlaceHolderImages) && PlaceHolderImages.length > 0) {
      const firstImg = PlaceHolderImages[0];
      if (firstImg?.imageUrl) {
        setCurrentImage(firstImg.imageUrl);
      }
    }
  }, []);

  const handleAnalyze = async () => {
    if (!currentImage) return;
    setIsAnalyzing(true);
    setError(null);
    const timestamp = new Date().toLocaleTimeString();

    try {
      console.log(`📡 [${timestamp}] [CLIENT_UPLINK] Transmission vers le centre de vision...`);
      
      // Analyse descriptive via le client hybride
      const analysis = await apiClient.post<VisionAssistantDescriptionOutput>('/api/vision/description', {
        photoDataUri: currentImage
      });
      if (analysis.error) throw new Error(analysis.error);
      setResult(analysis);
      
      // Récupération RAG via le client hybride
      const retrieved = await apiClient.post<VisualDocumentRetrievalOutput>('/api/vision/retrieval', {
        imageDataUri: currentImage
      });
      if (retrieved.error) throw new Error(retrieved.error);
      setDocs(retrieved);

      console.log(`✅ [${timestamp}] [CLIENT_SUCCESS] Analyse et RAG terminés avec succès.`);
    } catch (err: any) {
      console.error(`❌ [${timestamp}] [CLIENT_ERROR] Liaison interrompue.`);
      setError(err.message || "Échec de liaison pendant l'analyse.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cycleImage = () => {
    if (!Array.isArray(PlaceHolderImages) || PlaceHolderImages.length <= 1) return;
    
    const currentIndex = PlaceHolderImages.findIndex(img => img?.imageUrl === currentImage);
    const nextIndex = (currentIndex + 1) % PlaceHolderImages.length;
    const nextImage = PlaceHolderImages[nextIndex];
    
    if (nextImage?.imageUrl) {
      setCurrentImage(nextImage.imageUrl);
      setResult(null);
      setDocs(null);
      setError(null);
    }
  };

  const hasMultipleImages = Array.isArray(PlaceHolderImages) && PlaceHolderImages.length > 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <Card className="lg:col-span-2 bg-black border-primary/20 relative overflow-hidden group">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <StatusBadge status="online" label="FLUX_CAM_01" />
          <StatusBadge status={isAnalyzing ? "busy" : "online"} label={isAnalyzing ? "AI_OCCUPÉE" : "AI_EN_ATTENTE"} />
        </div>
        
        <div className="relative w-full h-full min-h-[400px]">
          {currentImage ? (
            <Image 
              src={currentImage} 
              alt="Flux en direct" 
              fill 
              className={cn("object-cover transition-opacity duration-500", isAnalyzing ? "opacity-40" : "opacity-80")}
              priority
              data-ai-hint="industrial machine"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/10">
              <Camera className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-code text-[10px] uppercase tracking-widest">
                Aucune entrée visuelle détectée
              </p>
            </div>
          )}
          
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-2 bg-[length:100%_4px,3px_100%] opacity-30" />
          
          {result?.objects.map((obj, i) => (
            <div 
              key={obj + i} 
              className="absolute border border-primary/50 bg-primary/10 text-primary text-[10px] p-1 font-code animate-in fade-in zoom-in duration-300"
              style={{ top: `${20 + (i * 12)}%`, left: `${15 + (i * 8)}%` }}
            >
              [DET] : {obj}
            </div>
          ))}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm z-20">
              <div className="bg-background border border-destructive p-4 flex flex-col items-center gap-3 max-w-xs text-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
                <p className="text-[10px] font-code text-destructive uppercase font-bold">{error}</p>
                <Button size="sm" variant="outline" onClick={handleAnalyze} className="h-7 text-[9px] uppercase font-code">Réessayer Liaison</Button>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="bg-background/80 hover:bg-background border-border" 
              onClick={cycleImage} 
              disabled={!hasMultipleImages || isAnalyzing}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              CHANGER SOURCE
            </Button>
          </div>
          <Button 
            disabled={isAnalyzing || !currentImage}
            onClick={handleAnalyze}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-headline font-bold uppercase tracking-wider text-xs"
          >
            {isAnalyzing ? (
              <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Cpu className="w-4 h-4 mr-2" />
            )}
            {isAnalyzing ? "Traitement..." : "Lancer l'Analyse"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4 h-full flex flex-col">
        <Card className="flex-1 bg-card/50 border-border p-4 overflow-auto terminal-scroll">
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-headline text-xs font-bold uppercase tracking-widest">Journaux d'Analyse</h3>
          </div>
          
          {result ? (
            <div className="space-y-4 font-code text-[11px] leading-relaxed">
              <div className="text-secondary opacity-80 uppercase tracking-tighter animate-pulse">
                [SUCCÈS] Traitement visuel terminé
              </div>
              <div className="p-2 bg-background/50 border border-border rounded-sm">
                <p className="text-muted-foreground mb-2 text-[10px] uppercase font-bold tracking-widest">&gt; Description</p>
                <p>{result.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-[10px] uppercase font-bold tracking-widest">&gt; Objets Identifiés</p>
                  <div className="flex flex-wrap gap-1">
                    {result.objects.map((o, i) => (
                      <span key={o + i} className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-sm">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-[10px] uppercase font-bold tracking-widest">&gt; Catégories</p>
                  <div className="flex flex-wrap gap-1">
                    {result.categories.map((c, i) => (
                      <span key={c + i} className="px-1.5 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-sm">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30">
              <Search className={cn("w-8 h-8 mb-2", isAnalyzing && "animate-spin text-primary")} />
              <p className="font-code text-[10px] uppercase tracking-widest">
                {isAnalyzing ? "Traitement Liaison..." : "En attente d'Analyse"}
              </p>
            </div>
          )}
        </Card>

        <Card className="flex-1 bg-card/50 border-border p-4 overflow-auto terminal-scroll">
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
            <Search className="w-4 h-4 text-primary" />
            <h3 className="font-headline text-xs font-bold uppercase tracking-widest">Registre RAG Visuel</h3>
          </div>

          {docs ? (
            <div className="space-y-3 font-code text-[11px]">
              <div className="p-2 border border-primary/20 bg-primary/5 rounded-sm mb-4">
                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">Correspondance Composant</p>
                <p className="text-primary font-bold uppercase">{docs.componentDescription}</p>
              </div>
              <div className="space-y-2">
                {docs.relevantDocuments.map((doc, i) => (
                  <div key={doc.title + i} className="p-2 border border-border bg-background/40 hover:border-primary/50 transition-colors cursor-pointer group rounded-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-primary font-bold uppercase tracking-tighter">{doc.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight italic">{doc.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30">
              <Layers className={cn("w-8 h-8 mb-2", isAnalyzing && "animate-bounce text-secondary")} />
              <p className="font-code text-[10px] uppercase tracking-widest">
                {isAnalyzing ? "Récupération Schémas..." : "Registre en Veille"}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
