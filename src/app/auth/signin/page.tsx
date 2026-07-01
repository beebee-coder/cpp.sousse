
"use client";

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Database } from 'lucide-react';

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

    const ts = new Date().toLocaleTimeString();
    console.log(`🔐 [AUTH_FRONT] [INIT] [${ts}] Soumission des identifiants...`);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const contentType = response.headers.get('content-type') || '';
      
      if (!contentType.includes('application/json')) {
        console.error(`🔐 [AUTH_FRONT] [ERROR] Réponse non-JSON du serveur.`);
        setError(`Erreur Serveur (HTTP ${response.status}).`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setLoading(false);

      if (!response.ok || !data.success) {
        console.warn(`🔐 [AUTH_FRONT] [REJECT] Échec authentification : ${data.message}`);
        setError(data.message || `Erreur ${response.status}`);
        return;
      }

      console.log(`🔐 [AUTH_FRONT] [SUCCESS] Accès autorisé. Redirection vers : ${callbackUrl}`);
      router.push(callbackUrl);
      router.refresh();
    } catch (e: any) {
      console.error(`🔐 [AUTH_FRONT] [FATAL] Panique liaison :`, e.message);
      setLoading(false);
      setError('Échec de liaison : Le serveur ne répond pas.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
             <Database className="w-5 h-5 text-primary" />
             <h1 className="text-2xl font-bold font-headline uppercase tracking-tight text-primary">VisioNode Access</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Contrôle industriel hybride CCP</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Identifiant Système</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@visionode.local"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Clé de Sécurité</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[10px] font-code uppercase font-medium leading-tight">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier la Liaison"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/50 text-xs text-center space-y-4">
          <p className="text-muted-foreground">Admin : <strong>admin@visionode.local</strong> / <strong>Admin@2024!</strong></p>
          <Link href="/auth/register" className="inline-block text-primary font-bold uppercase tracking-widest underline-offset-4 hover:underline">
            Demander une accréditation
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center p-6 text-xs uppercase font-code">Initialisation du Terminal...</div>}>
      <SignInForm />
    </Suspense>
  );
}
