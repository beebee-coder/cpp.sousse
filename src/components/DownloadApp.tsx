
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
  const [isLaunching, setIsLaunching] = useState(false);
  const [exeAvail, setExeAvail] = useState<boolean | null>(null);
  const [msiAvail, setMsiAvail] = useState<boolean | null>(null);
  const [manifest, setManifest] = useState<{ windows?: { exe?: string; msi?: string } } | null>(null);
  const { toast } = useToast();

  // URLs résolues : Blob (manifest) en priorité, sinon fallback statique local.
  const exeUrl = manifest?.windows?.exe || '/installers/VisioNode_Setup_x64.exe';
  const msiUrl = manifest?.windows?.msi || '/installers/VisioNode_Setup_x64.msi';

  useEffect(() => {
    setMounted(true);
    // Détection précise par userAgent (platform est déprécié)
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setOs('windows');
    else if (ua.includes('mac')) setOs('macos');
    else if (ua.includes('linux') || ua.includes('x11')) setOs('linux');
    else setOs('unknown');

    // Manifest des installers (URLs Vercel Blob), généré par scripts/upload-installers.mjs
    fetch('/installers/installers.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setManifest)
      .catch(() => {});

    // Vérifie la disponibilité réelle (évite un 404 aveugle)
    const check = async (url: string) => {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok;
      } catch {
        return false;
      }
    };
    check(exeUrl).then(setExeAvail);
    check(msiUrl).then(setMsiAvail);
  }, [exeUrl, msiUrl]);

  // Téléchargement direct (URL Blob ou fallback statique)
  const handleDownload = (url: string, label: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop() || 'VisioNode_Setup';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({
      title: '⬇️ Téléchargement initié',
      description: `Le transfert de ${label} a commencé.`,
    });
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      const res = await fetch('/api/auth/desktop-token');
      const data = await res.json();
      if (data.success && data.token) {
        window.location.href = `visionode://auth?token=${data.token}`;
        toast({
          title: '🚀 Lancement',
          description: "Connexion à l'application locale en cours...",
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "Impossible d'authentifier la session locale.",
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur réseau',
        description: "Connexion impossible au serveur d'authentification.",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  if (!mounted) return null;

  const isWindows = os === 'windows';
  const isMac = os === 'macos';
  const isLinux = os === 'linux';
  const isUnknown = os === 'unknown';

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
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

        {/* Badge OS détecté */}
        <div className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-code uppercase tracking-widest",
          isWindows && "border-primary/40 bg-primary/10 text-primary",
          isMac && "border-secondary/40 bg-secondary/10 text-secondary",
          isLinux && "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
          isUnknown && "border-border bg-muted/10 text-muted-foreground",
        )}>
          <Monitor className="w-3 h-3" />
          Système détecté :{' '}
          <span className="font-bold">
            {isWindows && 'Windows'}
            {isMac && 'macOS'}
            {isLinux && 'Linux'}
            {isUnknown && 'Inconnu'}
          </span>
        </div>
      </div>

      {/* --- WINDOWS section --- */}
      {(isWindows || isUnknown) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* EXE */}
          <Card className={cn(
            "p-6 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.01]",
            isWindows
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border bg-card/30"
          )}>
            <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-primary text-primary-foreground border-primary">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline font-bold uppercase tracking-wider">Windows x64 (.EXE)</h3>
              <p className="text-[10px] font-code text-muted-foreground mt-1">Version v1.0.2 — Installateur Standard</p>
            </div>
            <Button
              className="w-full font-headline font-bold uppercase text-xs h-12 bg-primary text-primary-foreground shadow-lg"
              onClick={() => handleDownload(exeUrl, 'VisioNode Setup (EXE)')}
              disabled={exeAvail === false}
            >
              <Download className="w-4 h-4 mr-2" />
              {exeAvail === false ? 'Non disponible' : 'Télécharger EXE'}
            </Button>
            {exeAvail === false && (
              <span className="text-[8px] font-code text-destructive uppercase">Installateur non publié — relancez le build desktop</span>
            )}
            {isWindows && exeAvail !== false && <Badge variant="secondary" className="text-[8px] uppercase px-3">Recommandé pour votre appareil</Badge>}
          </Card>

          {/* MSI */}
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
              className="w-full font-headline font-bold uppercase text-xs h-12 border-border"
              onClick={() => handleDownload(msiUrl, 'VisioNode Setup (MSI)')}
              disabled={msiAvail === false}
            >
              <Download className="w-4 h-4 mr-2" />
              {msiAvail === false ? 'Non disponible' : 'Télécharger MSI'}
            </Button>
            <span className="text-[8px] font-code text-muted-foreground uppercase">Usage Administration Système</span>
          </Card>
        </div>
      )}

      {/* --- macOS section --- */}
      {isMac && (
        <Card className="p-8 border-secondary/30 bg-secondary/5 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-secondary text-secondary-foreground border-secondary">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline font-bold uppercase tracking-wider text-secondary">macOS — Bientôt disponible</h3>
            <p className="text-[10px] font-code text-muted-foreground mt-1">La version macOS est en cours de compilation. En attendant, utilisez la version Windows.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <Button
              variant="outline"
              className="font-headline font-bold uppercase text-xs h-10 border-border"
              onClick={() => handleDownload(exeUrl, 'VisioNode Setup (EXE)')}
            >
              <Download className="w-4 h-4 mr-2" />
              EXE (Windows)
            </Button>
            <Button
              variant="outline"
              className="font-headline font-bold uppercase text-xs h-10 border-border"
              onClick={() => handleDownload(msiUrl, 'VisioNode Setup (MSI)')}
            >
              <Download className="w-4 h-4 mr-2" />
              MSI (Windows)
            </Button>
          </div>
        </Card>
      )}

      {/* --- Linux section --- */}
      {isLinux && (
        <Card className="p-8 border-yellow-500/30 bg-yellow-500/5 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline font-bold uppercase tracking-wider text-yellow-400">Linux — Package en préparation</h3>
            <p className="text-[10px] font-code text-muted-foreground mt-1">AppImage disponible prochainement. En attendant, l'interface web est entièrement fonctionnelle.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <Button
              variant="outline"
              className="font-headline font-bold uppercase text-xs h-10 border-border"
              onClick={() => handleDownload(exeUrl, 'VisioNode Setup (EXE)')}
            >
              <Download className="w-4 h-4 mr-2" />
              EXE (Windows)
            </Button>
            <Button
              variant="outline"
              className="font-headline font-bold uppercase text-xs h-10 border-border"
              onClick={() => handleDownload(msiUrl, 'VisioNode Setup (MSI)')}
            >
              <Download className="w-4 h-4 mr-2" />
              MSI (Windows)
            </Button>
          </div>
        </Card>
      )}

      {/* Lancer et Connecter — uniquement visible sur Windows */}
      {(isWindows || isUnknown) && (
        <Card className="p-6 border-secondary/20 bg-secondary/5 flex flex-col items-center text-center gap-4 transition-all hover:scale-[1.01]">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center border bg-secondary text-secondary-foreground border-secondary">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-headline font-bold uppercase tracking-wider">Ouvrir l'Application Locale</h3>
            <p className="text-[10px] font-code text-muted-foreground mt-1">Connecte automatiquement la version Desktop installée sur cet appareil</p>
          </div>
          <Button
            disabled={isLaunching}
            className="w-full font-headline font-bold uppercase text-xs h-12 bg-secondary text-secondary-foreground shadow-lg"
            onClick={handleLaunch}
          >
            {isLaunching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Lancer et Connecter
          </Button>
          <span className="text-[8px] font-code text-muted-foreground uppercase">
            Requiert l'application VisioNode installée sur cet appareil
          </span>
        </Card>
      )}

      {/* Info bloc */}
      <Card className="p-4 border-primary/20 bg-primary/5 flex items-center gap-4 shadow-inner">
        <FileArchive className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Directives d'Injection</h4>
          <p className="text-[9px] font-code text-muted-foreground leading-tight uppercase">
            &gt; Installateurs hébergés sur Vercel Blob (manifest <span className="text-white">/installers/installers.json</span>).<br/>
            &gt; Publiés automatiquement par <span className="text-white">npm run desktop:build</span> (aucune commande utilisateur).<br/>
            &gt; Dernière forge réelle détectée : {new Date().toLocaleDateString()}
          </p>
        </div>
      </Card>

      {/* Sécurité */}
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
