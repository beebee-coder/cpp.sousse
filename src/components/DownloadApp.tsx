"use client";

import { useState, useEffect } from 'react';
import { 
  Download, 
  Monitor, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  ChevronRight,
  Laptop,
  Terminal,
  Info,
  ShieldAlert,
  FileArchive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OS = 'windows' | 'macos' | 'linux' | 'unknown';

export function DownloadApp() {
  const [os, setOs] = useState<OS>('unknown');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const platform = window.navigator.platform.toLowerCase();
    if (platform.includes('win')) setOs('windows');
    else if (platform.includes('mac')) setOs('macos');
    else if (platform.includes('linux')) setOs('linux');
  }, []);

  const handleDownload = (targetOs: OS) => {
    // Utilise la route API pour gérer le flux de téléchargement
    window.location.href = `/api/download?platform=${targetOs}`;
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-code uppercase tracking-widest mb-2">
          <Zap className="w-3 h-3 animate-pulse" />
          Hébergement Direct Activé
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-headline font-bold uppercase tracking-tighter text-white">Station de Distribution</h1>
        <p className="text-muted-foreground font-code text-xs sm:text-sm max-w-2xl mx-auto px-4">
          Téléchargez les binaires de contrôle directement depuis le serveur central. 
          Certifiés pour un usage industriel hors-ligne.
        </p>
      </div>

      {/* Main Download Action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <DownloadCard 
          title="Windows x64" 
          icon={Monitor} 
          recommended={os === 'windows'}
          onDownload={() => handleDownload('windows')}
          version="v1.0.0 (Setup Local)"
          ext=".EXE"
        />
        <DownloadCard 
          title="macOS Silicon" 
          icon={Laptop} 
          recommended={os === 'macos'}
          onDownload={() => handleDownload('macos')}
          version="v1.0.0 (Direct)"
          ext=".DMG"
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <DownloadCard 
            title="Linux Engine" 
            icon={Terminal} 
            recommended={os === 'linux'}
            onDownload={() => handleDownload('linux')}
            version="v0.9.8 (Direct)"
            ext=".AppImage"
          />
        </div>
      </div>

      {/* Local Storage Info */}
      <Card className="p-4 border-primary/20 bg-primary/5 flex items-center gap-4">
        <FileArchive className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Avis aux Administrateurs</h4>
          <p className="text-[9px] font-code text-muted-foreground leading-tight uppercase">
            &gt; Les fichiers sont stockés dans le registre local /public/installers/.<br/>
            &gt; Vérifiez la présence du fichier VisioNode_Setup_x64.exe avant distribution.
          </p>
        </div>
      </Card>

      {/* Security & Integrity Section */}
      <Card className="p-6 border-secondary/20 bg-secondary/5">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-8 h-8 text-secondary" />
          </div>
          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="font-headline font-bold uppercase text-secondary tracking-widest">Audit de Sécurité SHA-256</h3>
            <p className="text-[10px] sm:text-xs font-code text-muted-foreground">
              Vérifiez l'empreinte numérique après téléchargement. 
              Garantie d'absence de corruption lors du transfert depuis le serveur central.
            </p>
            <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-2">
              <Badge variant="outline" className="font-code text-[9px] border-secondary/30">WIN: 7f8a...2e10</Badge>
              <Badge variant="outline" className="font-code text-[9px] border-secondary/30">MAC: a4b1...8c3f</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 border-border bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-code uppercase text-muted-foreground text-center sm:text-left">
            Dernière mise à jour du registre : {new Date().toLocaleDateString()}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[9px] uppercase font-code">
          Notes de version <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </Card>
    </div>
  );
}

function DownloadCard({ title, icon: Icon, recommended, onDownload, version, ext }: any) {
  return (
    <Card className={cn(
      "p-6 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.02] shadow-xl",
      recommended ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card/30"
    )}>
      <div className={cn(
        "w-12 h-12 rounded-sm flex items-center justify-center border",
        recommended ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-headline font-bold uppercase tracking-wider">{title}</h3>
        <p className="text-[10px] font-code text-muted-foreground mt-1">{version}</p>
      </div>
      <Button 
        className={cn(
          "w-full font-headline font-bold uppercase text-xs h-10 shadow-lg",
          recommended ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
        )}
        onClick={onDownload}
      >
        <Download className="w-4 h-4 mr-2" />
        Télécharger {ext}
      </Button>
      {recommended && (
        <Badge variant="secondary" className="text-[8px] uppercase px-3">
          Cible Détectée
        </Badge>
      )}
    </Card>
  );
}
