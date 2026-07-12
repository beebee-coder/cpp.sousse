"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Database, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Logo3D } from '@/components/three/Logo3D';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!token) {
      setError('Lien de réinitialisation manquant ou invalide.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.post<{ message?: string }>('/api/auth/reset-password', { token, newPassword });
      setLoading(false);

      if (!data.success) {
        setError(data.error || "Échec de la réinitialisation.");
        return;
      }

      setDone(true);
      setMessage(data.message || 'Mot de passe réinitialisé avec succès.');
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Le centre de contrôle est injoignable.");
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/70 glass-panel p-8 shadow-glow-lg animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="glow-ring rounded-xl p-1.5 mb-4 animate-float">
            <Logo3D size={52} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold font-headline uppercase tracking-tight text-gradient">COPILOTE-CCPE</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 uppercase font-code text-[10px] tracking-widest">
            {done ? "Accès restauré" : "Nouveau mot de passe"}
          </p>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-md bg-secondary/10 border border-secondary/30 text-secondary animate-in fade-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[10px] font-code uppercase leading-tight font-bold">{message}</p>
            </div>
            <Link
              href="/auth/signin"
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-glow"
            >
              Retour à la liaison
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Nouvelle clé de sécurité</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-border bg-black/40 pl-3 pr-10 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Confirmer la clé</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-black/40 px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] font-code uppercase leading-tight font-bold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-glow"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Réinitialiser la clé"}
            </button>
          </form>
        )}

        {!done && (
          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <Link href="/auth/signin" className="inline-flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px] underline-offset-4 hover:underline">
              <ArrowLeft className="w-3 h-3" /> Retour à la liaison
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center p-6 text-xs uppercase font-code">Initialisation du terminal...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
