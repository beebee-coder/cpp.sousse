"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, Database, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Logo3D } from '@/components/three/Logo3D';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setResetUrl(null);
    setLoading(true);

    try {
      const data = await apiClient.post<{ resetToken?: string }>('/api/auth/forgot-password', { email });
      setLoading(false);

      if (!data.success) {
        setError(data.error || "Une erreur s'est produite.");
        return;
      }

      setMessage(data.message || 'Un lien de réinitialisation a été généré.');

      // Aucune infrastructure email (SMTP) dans le projet : le jeton est
      // consommé directement dans l'application via le lien ci-dessous.
      if (data.resetToken) {
        setResetUrl(`/auth/reset-password?token=${encodeURIComponent(data.resetToken)}`);
      }
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
          <p className="text-sm text-muted-foreground mt-1 uppercase font-code text-[10px] tracking-widest">Réinitialisation d'accès</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Identifiant Système</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@visionode.local"
                className="w-full rounded-md border border-border bg-black/40 pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-code"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive animate-in fade-in zoom-in-95 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[10px] font-code uppercase leading-tight font-bold">{error}</p>
            </div>
          )}

          {message && !error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-secondary/10 border border-secondary/30 text-secondary animate-in fade-in zoom-in-95 duration-200">
              <Mail className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[10px] font-code uppercase leading-tight font-bold">{message}</p>
            </div>
          )}

          {resetUrl ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-md bg-secondary/10 border border-secondary/30 text-secondary animate-in fade-in zoom-in-95 duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] font-code uppercase leading-tight font-bold">
                  Lien de réinitialisation généré (aucun email n'est envoyé par ce système).
                </p>
              </div>
              <Link
                href={resetUrl}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-glow"
              >
                Ouvrir le lien de réinitialisation
              </Link>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-glow"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Générer le lien"}
            </button>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-border/50 text-center">
          <Link href="/auth/signin" className="inline-flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px] underline-offset-4 hover:underline">
            <ArrowLeft className="w-3 h-3" /> Retour à la liaison
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center p-6 text-xs uppercase font-code">Initialisation du terminal...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
