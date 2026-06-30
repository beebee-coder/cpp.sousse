"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Tentative de lecture sécurisée du JSON
      let data;
      try {
        data = await response.json();
      } catch (e) {
        setError(`Réponse serveur invalide (HTTP ${response.status}). Le service d'authentification est mal configuré.`);
        setLoading(false);
        return;
      }

      setLoading(false);

      if (!response.ok || !data || !data.success) {
        setError(data?.message || `Erreur système inattendue (Code: ${response.status})`);
        return;
      }

      // Succès : Redirection
      router.push(callbackUrl);
    } catch (e) {
      setLoading(false);
      setError('Impossible de joindre le serveur. Vérifiez votre connexion ou la disponibilité de la base de données.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-headline uppercase tracking-tight text-primary">Connexion VisioNode</h1>
          <p className="text-sm text-muted-foreground mt-1">Plateforme de contrôle industriel CCP</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Email Professionnel</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@visionode.local"
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Clé d'Accès</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-tight">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "S'identifier"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/50 text-xs text-center space-y-4">
          <p className="text-muted-foreground">Utilisez <strong>Admin@2024!</strong> pour le compte admin</p>
          <Link href="/auth/register" className="inline-block text-primary font-bold uppercase tracking-widest underline-offset-4 hover:underline">
            Demander un accès prioritaire
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center p-6 text-xs uppercase font-code">Chargement de la liaison...</div>}>
      <SignInForm />
    </Suspense>
  );
}
