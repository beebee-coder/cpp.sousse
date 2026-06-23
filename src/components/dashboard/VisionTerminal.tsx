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
      
      const analysis = await apiClient.post<VisionAssistantDescriptionOutput>('/api/vision/description', {
        photoDataUri: currentImage
      });
      if (analysis.error) throw new Error(analysis.error);
      setResult(analysis);
      
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
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 h-full">
      {/* Flux Vidéo Principal */}
      <Card className="lg:col-span-2 bg-black border-primary/20 relative overflow-hidden group min-h-[300px] sm:min-h-[400px] lg:min-h-0 shrink-0">
        <div className="absolute top-4 left-4 lg:left-4 z-10 flex gap-2">
          <div className="lg:hidden w-10" /> {/* Spacer pour mobile menu */}
          <StatusBadge status="online" label="CAM_01" />
          <StatusBadge status={isAnalyzing ? "busy" : "online"} label={isAnalyzing ? "BUSY" : "READY"} />
        </div>
        
        <div className="relative w-full h-full min-h-[300px] sm:min-h-[400px]">
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
                Aucune entrée détectée
              </p>
            </div>
          )}
          
          {/* Scanlines Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-2 bg-[length:100%_4px,3px_100%] opacity-30" />
          
          {/* Detected Objects Overlay */}
          {result?.objects.slice(0, 3).map((obj, i) => (
            <div 
              key={obj + i} 
              className="absolute border border-primary/50 bg-primary/10 text-primary text-[8px] sm:text-[10px] p-1 font-code animate-in fade-in zoom-in duration-300 backdrop-blur-[2px]"
              style={{ top: `${25 + (i * 12)}%`, left: `${15 + (i * 5)}%` }}
            >
              [DET] : {obj}
            </div>
          ))}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm z-20 p-4">
              <div className="bg-background border border-destructive p-4 flex flex-col items-center gap-3 max-w-xs text-center rounded-sm">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <p className="text-[9px] font-code text-destructive uppercase font-bold">{error}</p>
                <Button size="sm" variant="outline" onClick={handleAnalyze} className="h-7 text-[9px] uppercase font-code">Réessayer</Button>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex flex-row justify-between items-center gap-2 z-10">
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-background/80 hover:bg-background border-border text-[9px] sm:text-[10px] uppercase font-bold h-8 sm:h-9" 
            onClick={cycleImage} 
            disabled={!hasMultipleImages || isAnalyzing}
          >
            <RefreshCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-2" />
            SOURCE
          </Button>
          <Button 
            disabled={isAnalyzing || !currentImage}
            onClick={handleAnalyze}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-headline font-bold uppercase tracking-wider text-[9px] sm:text-[10px] h-8 sm:h-9 lg:h-10 px-3 sm:px-6 shadow-xl"
          >
            {isAnalyzing ? (
              <RefreshCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-2 animate-spin" />
            ) : (
              <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-2" />
            )}
            {isAnalyzing ? "Traitement..." : "Analyser"}
          </Button>
        </div>
      </Card>

      {/* Analyse Panes */}
      <div className="flex flex-col sm:flex-row lg:flex-col gap-4 min-h-0 flex-1">
        <Card className="flex-1 bg-card/50 border-border p-3 sm:p-4 overflow-auto terminal-scroll min-h-[150px] sm:min-h-[180px]">
          <div className="flex items-center gap-2 mb-3 border-b border-border pb-2 shrink-0">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <h3 className="font-headline text-[10px] lg:text-xs font-bold uppercase tracking-widest">Journaux d'Analyse</h3>
          </div>
          
          {result ? (
            <div className="space-y-3 font-code text-[10px] lg:text-[11px] leading-relaxed">
              <div className="p-2 bg-background/50 border border-border rounded-sm">
                <p className="text-muted-foreground mb-1 text-[8px] sm:text-[9px] uppercase font-bold">&gt; Description</p>
                <p>{result.description}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {result.objects.map((o, i) => (
                  <span key={o + i} className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-sm text-[8px] sm:text-[9px]">
                    {o}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 py-6 sm:py-8">
              <Search className={cn("w-5 h-5 sm:w-6 sm:h-6 mb-2", isAnalyzing && "animate-spin text-primary")} />
              <p className="font-code text-[8px] sm:text-[9px] uppercase tracking-widest text-center">
                {isAnalyzing ? "Traitement..." : "En attente"}
              </p>
            </div>
          )}
        </Card>

        <Card className="flex-1 bg-card/50 border-border p-3 sm:p-4 overflow-auto terminal-scroll min-h-[150px] sm:min-h-[180px]">
          <div className="flex items-center gap-2 mb-3 border-b border-border pb-2 shrink-0">
            <Search className="w-3.5 h-3.5 text-primary" />
            <h3 className="font-headline text-[10px] lg:text-xs font-bold uppercase tracking-widest">Registre RAG</h3>
          </div>

          {docs ? (
            <div className="space-y-2 font-code text-[10px] lg:text-[11px]">
              <div className="p-1.5 border border-primary/20 bg-primary/5 rounded-sm">
                <p className="text-primary font-bold uppercase text-[8px] sm:text-[9px]">{docs.componentDescription}</p>
              </div>
              <div className="space-y-1.5">
                {docs.relevantDocuments.map((doc, i) => (
                  <div key={doc.title + i} className="p-2 border border-border bg-background/40 hover:border-primary/50 transition-colors cursor-pointer group rounded-sm">
                    <span className="text-primary font-bold uppercase text-[8px] sm:text-[9px] block truncate">{doc.title}</span>
                    <p className="text-[8px] sm:text-[9px] text-muted-foreground leading-tight italic line-clamp-2">{doc.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 py-6 sm:py-8">
              <Layers className={cn("w-5 h-5 sm:w-6 sm:h-6 mb-2", isAnalyzing && "animate-bounce text-secondary")} />
              <p className="font-code text-[8px] sm:text-[9px] uppercase tracking-widest text-center">
                {isAnalyzing ? "Récupération..." : "Registre en Veille"}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
