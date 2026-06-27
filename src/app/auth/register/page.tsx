"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  type UserRole = 'admin' | 'chef-de-bloc' | 'chef-de-quart' | 'user';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, password, role }),
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      setLoading(false);

      if (!response.ok || !data || !data.success) {
        setMessage(data?.message || 'Impossible d’envoyer la demande pour le moment.');
        setSuccess(false);
        return;
      }

      setMessage(data?.message || 'Demande envoyée.');
      setSuccess(true);

      if (response.ok) {
        setFirstName('');
        setLastName('');
        setPassword('');
        setTimeout(() => router.push('/auth/signin'), 1200);
      }
    } catch {
      setLoading(false);
      setSuccess(false);
      setMessage('Impossible d’envoyer la demande pour le moment.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Demander un accès</h1>
        <p className="text-sm text-muted-foreground mb-6">Votre compte sera confirmé par l’administrateur.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-muted-foreground">
            Prénom
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2"
              required
            />
          </label>

          <label className="block text-sm font-medium text-muted-foreground">
            Nom
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2"
              required
            />
          </label>

          <fieldset className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <legend className="text-sm font-medium text-muted-foreground">Rôle demandé</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="radio"
                  name="role"
                  value="user"
                  checked={role === 'user'}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-4 w-4 text-primary ring-offset-background focus:ring-primary"
                />
                Utilisateur
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="radio"
                  name="role"
                  value="chef-de-bloc"
                  checked={role === 'chef-de-bloc'}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-4 w-4 text-primary ring-offset-background focus:ring-primary"
                />
                Chef de bloc
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="radio"
                  name="role"
                  value="chef-de-quart"
                  checked={role === 'chef-de-quart'}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-4 w-4 text-primary ring-offset-background focus:ring-primary"
                />
                Chef de quart
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-4 w-4 text-primary ring-offset-background focus:ring-primary"
                />
                Admin
              </label>
            </div>
          </fieldset>

          <label className="block text-sm font-medium text-muted-foreground">
            Mot de passe
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              type="password"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2"
              required
            />
          </label>

          {message ? (
            <p className={`${success ? 'text-sm text-primary' : 'text-sm text-red-500'} mt-1`}>
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </form>

        <div className="mt-6 text-sm text-muted-foreground">
          <Link href="/auth/signin" className="text-primary underline-offset-4 hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
