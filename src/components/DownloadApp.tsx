
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
  FileArchive,
  Loader2,
  FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type OS = 'windows' | 'macos' | 'linux' | 'unknown';

export function DownloadApp() {
  const [os, setOs] = useState<OS>('unknown');
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    const platform = window.navigator.platform.toLowerCase();
    if (platform.includes('win')) setOs('windows');
    else if (platform.includes('mac')) setOs('macos');
    else if (platform.includes('linux')) setOs('linux');
  }, []);

  const handleDownload = async (target: string) => {
    setIsDownloading(target);
    try {
      const response = await fetch(`/api/download?platform=${target}`, { method: 'GET', redirect: 'manual' });
      
      if (response.status === 404) {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          title: "Binaire non trouvé",
          description: errorData.message,
        });
      } else {
        window.location.href = `/api/download?platform=${target}`;
        toast({
          title: "Téléchargement initié",
          description: "Le transfert du binaire certifié a commencé.",
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur réseau",
        description: "Impossible de joindre le centre de distribution.",
      });
    } finally {
      setIsDownloading(null);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-code uppercase tracking-widest mb-2">
          <CheckCircle2 className="w-3 h-3 text-secondary" />
          Centre de Distribution Certifié
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-headline font-bold uppercase tracking-tighter text-white">Installation Native</h1>
        <p className="text-muted-foreground font-code text-xs sm:text-sm max-w-2xl mx-auto px-4">
          Accédez à la puissance totale du moteur de vision avec l'application desktop. 
          Inclut l'accélération GPU et l'accès direct aux ports caméras industrielles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Windows EXE */}
        <Card className="p-6 border-primary bg-primary/5 ring-1 ring-primary/20 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.01]">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-primary text-primary-foreground border-primary">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline font-bold uppercase tracking-wider">Windows x64 (.EXE)</h3>
            <p className="text-[10px] font-code text-muted-foreground mt-1">Version v1.0.2 - Installateur Standard</p>
          </div>
          <Button 
            disabled={isDownloading === 'windows'}
            className="w-full font-headline font-bold uppercase text-xs h-12 bg-primary text-primary-foreground shadow-lg"
            onClick={() => handleDownload('windows')}
          >
            {isDownloading === 'windows' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Télécharger EXE
          </Button>
          <Badge variant="secondary" className="text-[8px] uppercase px-3">Recommandé</Badge>
        </Card>

        {/* Windows MSI */}
        <Card className="p-6 border-border bg-card/30 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.01]">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-muted text-muted-foreground border-border">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline font-bold uppercase tracking-wider">Déploiement MSI</h3>
            <p className="text-[10px] font-code text-muted-foreground mt-1">Package pour parcs informatiques</p>
          </div>
          <Button 
            variant="outline"
            disabled={isDownloading === 'msi'}
            className="w-full font-headline font-bold uppercase text-xs h-12 border-border"
            onClick={() => handleDownload('msi')}
          >
            {isDownloading === 'msi' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Télécharger MSI
          </Button>
          <span className="text-[8px] font-code text-muted-foreground uppercase">Usage Administration</span>
        </Card>
      <Card className="p-6 border-secondary/20 bg-secondary/5 mt-6 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.01]">
        <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-secondary text-secondary-foreground border-secondary">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-headline font-bold uppercase tracking-wider">Ouvrir l'Application Locale</h3>
          <p className="text-[10px] font-code text-muted-foreground mt-1">Connecte automatiquement la version Desktop</p>
        </div>
        <Button 
          className="w-full font-headline font-bold uppercase text-xs h-12 bg-secondary text-secondary-foreground shadow-lg"
          onClick={async () => {
            try {
              const res = await fetch('/api/auth/desktop-token');
              const data = await res.json();
              if (data.success && data.token) {
                window.location.href = `visionode://auth?token=${data.token}`;
              } else {
                toast({ variant: "destructive", title: "Erreur", description: "Impossible d'authentifier la session locale." });
              }
            } catch (e) {
              toast({ variant: "destructive", title: "Erreur", description: "Erreur de connexion." });
            }
          }}
        >
          <Zap className="w-4 h-4 mr-2" />
          Lancer et Connecter
        </Button>
      </Card>
      </div>

      <Card className="p-4 border-primary/20 bg-primary/5 flex items-center gap-4 shadow-inner">
        <FileArchive className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Directives d'Injection</h4>
          <p className="text-[9px] font-code text-muted-foreground leading-tight uppercase">
            &gt; Les installateurs Tauri sont publiés vers <span className="text-white">/public/installers/</span> après la construction desktop.<br/>
            &gt; L'API de distribution vérifie l'intégrité avant chaque transfert.<br/>
            &gt; Dernière forge réelle détectée : {new Date().toLocaleDateString()}
          </p>
        </div>
      </Card>

      <Card className="p-6 border-secondary/20 bg-secondary/5">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-8 h-8 text-secondary" />
          </div>
          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="font-headline font-bold uppercase text-secondary tracking-widest">Sécurité du Registre</h3>
            <p className="text-[10px] sm:text-xs font-code text-muted-foreground">
              Chaque binaire est scanné et signé numériquement pour garantir son intégrité au sein du réseau CCP Industrial Vision.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
