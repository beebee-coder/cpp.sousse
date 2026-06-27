"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type UserRole = 'admin' | 'chef-de-bloc' | 'chef-de-quart' | 'user';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, password, role }),
    });

    setLoading(false);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok || !data || !data.success) {
      setError(data?.message || 'Identifiants invalides ou compte non approuvé.');
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Connexion VisioNode</h1>
        <p className="text-sm text-muted-foreground mb-6">Utilisez votre prénom, nom et mot de passe.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Prénom"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Nom"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="user">Utilisateur</option>
            <option value="chef-de-bloc">Chef de bloc</option>
            <option value="chef-de-quart">Chef de quart</option>
            <option value="admin">Admin</option>
          </select>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            type="password"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-sm text-muted-foreground">
          <p>Pas encore de compte ?</p>
          <Link href="/auth/register" className="mt-2 inline-flex text-primary underline-offset-4 hover:underline">
            Demander un accès à l’administrateur
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center p-6">Chargement…</div>}>
      <SignInForm />
    </Suspense>
  );
}
