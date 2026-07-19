"use client";

import { TopNavbar } from '@/components/dashboard/TopNavbar';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { usePlatform } from '@/components/PlatformProvider';
import { useAppMode } from '@/hooks/use-app-mode';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TiltCard } from '@/components/three/TiltCard';
import { performHealthCheck } from '@/lib/platform';
import { User, ShieldCheck, Cpu, Cloud, Mail, Fingerprint, Circle, LogOut, Save, RotateCcw, KeyRound, CheckCircle2, AlertTriangle, Camera, Upload, Trash2 } from 'lucide-react';
import { fileToDataUrl, resizeDataUrl, MAX_DIM } from '@/lib/image-helpers';

interface ProfileUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: string;
  approved?: boolean;
  image?: string | null;
  createdAt?: number;
}

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<{ healthy: boolean; issues: string[] } | null>(null);
  const [role, setRole] = useState<string | undefined>(undefined);
  const { isDesktop } = usePlatform();
  const { mode, localOnly } = useAppMode();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [imageData, setImageData] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayImage = imageData === null ? (profile?.image ?? null) : imageData;

  useEffect(() => {
    setMounted(true);
    setHealth(performHealthCheck());

    const loadSession = async () => {
      try {
        const res = await apiClient.get<any>('/api/auth/me');
        if (!res.success) {
          setMessage({ type: 'error', text: res.error === 'RÉSEAU_INDISPONIBLE' ? 'Cloud indisponible. Vérifiez votre connexion.' : 'Session invalide. Veuillez vous reconnecter.' });
          return;
        }
        const user = (res.user ?? res.session?.user) as ProfileUser | undefined;
        if (user) {
          setProfile(user);
          setRole(user.role);
          setForm({
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            email: user.email ?? '',
          });
        } else {
          setMessage({ type: 'error', text: 'Session invalide. Veuillez vous reconnecter.' });
        }
      } catch {
        setMessage({ type: 'error', text: 'Impossible de charger le profil. Vérifiez votre connexion.' });
      }
    };

    void loadSession();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const resetForm = () => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      email: profile.email ?? '',
    });
    setImageData(null);
    setPasswords({ current: '', next: '', confirm: '' });
    setMessage(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      const resized = await resizeDataUrl(raw);
      setImageData(resized);
    } catch {
      setMessage({ type: 'error', text: 'Impossible de lire ou redimensionner cette image.' });
    }
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
      setMessage({ type: 'error', text: 'Accès à la caméra indisponible.' });
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || MAX_DIM;
    const h = video.videoHeight || MAX_DIM;
    const size = Math.min(w, h);
    const sx = (w - size) / 2;
    const sy = (h - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = MAX_DIM;
    canvas.height = MAX_DIM;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, sx, sy, size, size, 0, 0, MAX_DIM, MAX_DIM);
      setImageData(canvas.toDataURL('image/jpeg', 0.85));
    }
    stopCapture();
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    if (passwords.next && passwords.next !== passwords.confirm) {
      setSaving(false);
      setMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    const body: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      currentPassword: passwords.current || undefined,
      newPassword: passwords.next || undefined,
    };
    if (imageData !== null && !localOnly) body.image = imageData;

    try {
      const res = await apiClient.patch<any>('/api/auth/me', body);
      if (!res.success) {
        const errMap: Record<string, string> = {
          EMAIL_ALREADY_EXISTS: 'Cet e-mail est déjà utilisé.',
          INVALID_CURRENT_PASSWORD: 'Mot de passe actuel incorrect.',
          USER_NOT_FOUND: 'Utilisateur introuvable.',
          INVALID_EMAIL: "Format d'e-mail invalide.",
          WEAK_PASSWORD: 'Le mot de passe doit contenir au moins 8 caractères.',
          INVALID_IMAGE: 'Image invalide (JPG/PNG/WebP, < 500 Ko).',
          UNAUTHENTICATED: 'Session expirée. Veuillez vous reconnecter.',
        };
        setMessage({ type: 'error', text: errMap[res.error] ?? 'Échec de la mise à jour.' });
        return;
      }
      if (res.user) {
        setProfile(res.user);
        setRole(res.user.role);
        setImageData(null);
        setPasswords({ current: '', next: '', confirm: '' });
        setMessage({ type: 'success', text: res.message?.includes('localement') ? res.message : 'Profil mis à jour avec succès.' });
      } else {
        setMessage({ type: 'error', text: 'Échec de la mise à jour.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau lors de la mise à jour.' });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'bg-background/60 border-border focus-visible:ring-primary';

  return (
    <div className="flex flex-col h-screen bg-transparent overflow-hidden">
      <TopNavbar
        health={health}
        mounted={mounted}
        isDesktop={isDesktop}
        mode={mode}
        role={role}
      />

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto flex flex-col gap-4 lg:gap-6">
            <div className="shrink-0">
              <h2 className="font-headline text-xl lg:text-2xl font-bold tracking-tight mb-1 uppercase">Profil Utilisateur</h2>
              <p className="text-xs text-muted-foreground font-code">
                {mounted ? mode.toUpperCase() : 'CHARGEMENT...'} | COMPTE | {role?.toUpperCase() ?? 'USER'}
              </p>
              {localOnly && (
                <p className="text-xs text-amber-500 font-code mt-1">
                  Mode local uniquement — les modifications sont sauvegardées localement et ne sont pas synchronisées avec le cloud.
                </p>
              )}
            </div>

            {message && (
              <div className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-code border shrink-0",
                message.type === 'success'
                  ? "bg-secondary/10 border-secondary/30 text-secondary"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              )}>
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Photo de profil */}
              <TiltCard className="rounded-lg">
                <Card glass className="p-6 border-primary/20 h-full">
                  <div className="flex items-center gap-2 mb-5">
                    <Camera className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Photo</h3>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <div className="glow-ring rounded-full p-1">
                      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 overflow-hidden">
                        {displayImage ? (
                          <img src={displayImage} alt="Profil" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-primary" />
                        )}
                      </div>
                    </div>

                    {capturing ? (
                      <div className="w-full flex flex-col items-center gap-3">
                        <video ref={videoRef} className="w-full max-w-[220px] rounded-md border border-border aspect-square object-cover bg-black/40" muted playsInline />
                        <div className="flex gap-2">
                          <Button onClick={takeSnapshot} className="flex items-center gap-1.5">
                            <Camera className="w-4 h-4" /> Capturer
                          </Button>
                          <Button variant="outline" onClick={stopCapture}>Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button variant="outline" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5">
                            <Upload className="w-4 h-4" /> Importer
                          </Button>
                          <Button variant="outline" onClick={startCapture} className="flex items-center gap-1.5">
                            <Camera className="w-4 h-4" /> Capturer
                          </Button>
                          {displayImage && (
                            <Button variant="outline" onClick={() => setImageData('')} className="flex items-center gap-1.5 text-destructive border-destructive/30">
                              <Trash2 className="w-4 h-4" /> Retirer
                            </Button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-code text-center">
                          JPG/PNG — redimensionné automatiquement.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </TiltCard>

              {/* Identité */}
              <TiltCard className="rounded-lg lg:col-span-2">
                <Card glass className="p-6 border-primary/20 h-full">
                  <div className="flex items-center gap-2 mb-5">
                    <User className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Identité</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-[10px] uppercase tracking-widest text-muted-foreground">Prénom</Label>
                      <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-[10px] uppercase tracking-widest text-muted-foreground">Nom</Label>
                      <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="email" className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> E-mail
                      </Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </Card>
              </TiltCard>
            </div>

            {/* Informations (lecture seule) */}
            <TiltCard className="rounded-lg">
              <Card glass className="p-6 border-primary/20">
                <div className="flex items-center gap-2 mb-5">
                  <Fingerprint className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Informations</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Rôle
                    </p>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-code uppercase font-bold border",
                      role === 'admin'
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-secondary/10 text-secondary border-secondary/30"
                    )}>
                      {role?.toUpperCase() ?? 'USER'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" /> ID
                    </p>
                    <p className="text-[11px] font-code text-foreground truncate">{mounted && profile?.id ? profile.id : '...'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      {isDesktop ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />} Mode
                    </p>
                     <p className="text-[11px] font-code text-primary font-bold">{mounted ? mode.toUpperCase() : '...'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Circle className="w-2.5 h-2.5 text-secondary fill-secondary" /> Session
                    </p>
                    <p className="text-[11px] font-code text-secondary font-bold">ACTIVE</p>
                  </div>
                </div>
              </Card>
            </TiltCard>

            {/* Sécurité — mot de passe */}
            <TiltCard className="rounded-lg">
              <Card glass className="p-6 border-primary/20">
                <div className="flex items-center gap-2 mb-5">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-widest font-headline">Sécurité</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="current" className="text-[10px] uppercase tracking-widest text-muted-foreground">Mot de passe actuel</Label>
                    <Input id="current" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="next" className="text-[10px] uppercase tracking-widest text-muted-foreground">Nouveau mot de passe</Label>
                    <Input id="next" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm" className="text-[10px] uppercase tracking-widest text-muted-foreground">Confirmer</Label>
                    <Input id="confirm" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-code mt-3">
                  Laissez les champs vides pour conserver le mot de passe actuel.
                </p>
              </Card>
            </TiltCard>

            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving ? <Circle className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={saving} className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Réinitialiser
              </Button>
              <button
                onClick={async () => {
                  await apiClient.post('/api/auth/signout', {});
                  window.location.href = '/auth/signin';
                }}
                className="ml-auto flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
