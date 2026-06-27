"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { CheckCircle2, XCircle, Clock, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  approved: boolean;
  createdAt: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<User[]>([]);
  const [approved, setApproved] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const sessionResponse = await fetch('/api/auth/me');
      const sessionData = await sessionResponse.json();
      const userRole = (sessionData.session?.user as any)?.role as string | undefined;
      setRole(userRole);

      if (userRole !== 'admin') {
        router.replace('/dashboard');
        return;
      }

      const response = await fetch('/api/auth/admin');
      const data = await response.json();
      setPending(data.pending || []);
      setApproved(data.users || []);
      setStats(data.stats || { total: 0, approved: 0, pending: 0 });
      setLoading(false);
    };

    void load();
  }, [router]);

  const handleApprove = async (userId: string) => {
    setActionInProgress(userId);
    const response = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'approve' }),
    });

    if (response.ok) {
      setPending((current) => current.filter((user) => user.id !== userId));
      const newUser = pending.find((u) => u.id === userId);
      if (newUser) {
        setApproved((current) => [...current, { ...newUser, approved: true }]);
      }
      setStats((current) => ({ ...current, pending: current.pending - 1, approved: current.approved + 1 }));
    }
    setActionInProgress(null);
  };

  const handleReject = async (userId: string) => {
    setActionInProgress(userId);
    const response = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'reject' }),
    });

    if (response.ok) {
      setPending((current) => current.filter((user) => user.id !== userId));
      setStats((current) => ({ ...current, pending: current.pending - 1 }));
    }
    setActionInProgress(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <p className="mt-4 text-muted-foreground">Chargement…</p>
          </div>
        </main>
      </div>
    );
  }

  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        <header className="h-16 border-b border-border bg-card/30 flex items-center px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h1 className="font-headline font-bold text-sm uppercase tracking-widest">Gestion des Utilisateurs</h1>
              <p className="text-[10px] text-muted-foreground">Approbation et gestion des comptes</p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total d'utilisateurs</p>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{stats.approved} approuvés</p>
            </div>

            <div className="rounded-lg border border-border bg-card/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">En attente</p>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-amber-500">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground mt-1">demandes à traiter</p>
            </div>

            <div className="rounded-lg border border-border bg-card/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Approuvés</p>
                <CheckCircle2 className="w-4 h-4 text-secondary" />
              </div>
              <p className="text-3xl font-bold text-secondary">{stats.approved}</p>
              <p className="text-[10px] text-muted-foreground mt-1">utilisateurs actifs</p>
            </div>
          </div>

          {/* Demandes en attente */}
          <div>
            <div className="mb-4">
              <h2 className="font-headline text-lg font-bold uppercase tracking-tight mb-1">
                Demandes en attente d'approbation
              </h2>
              <p className="text-xs text-muted-foreground">
                {pending.length === 0 ? 'Aucune demande en attente' : `${pending.length} demande${pending.length > 1 ? 's' : ''}`}
              </p>
            </div>

            {pending.length === 0 ? (
              <div className="rounded-lg border border-border bg-card/30 p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-secondary/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Toutes les demandes ont été traitées !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-lg border border-border bg-card/50 p-4 hover:bg-card/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-headline font-bold uppercase text-sm">{user.firstName} {user.lastName}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Rôle demandé : {user.role === 'chef-de-bloc' ? 'Chef de bloc' : user.role === 'chef-de-quart' ? 'Chef de quart' : user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] text-amber-500 font-medium uppercase">En attente</span>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={actionInProgress === user.id}
                          className="flex items-center gap-2 rounded-md bg-secondary/20 px-3 py-2 text-xs font-bold uppercase text-secondary hover:bg-secondary/30 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approuver
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          disabled={actionInProgress === user.id}
                          className="flex items-center gap-2 rounded-md bg-destructive/20 px-3 py-2 text-xs font-bold uppercase text-destructive hover:bg-destructive/30 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Rejeter
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Utilisateurs approuvés */}
          <div>
            <div className="mb-4">
              <h2 className="font-headline text-lg font-bold uppercase tracking-tight mb-1">
                Utilisateurs approuvés
              </h2>
              <p className="text-xs text-muted-foreground">
                {approved.length === 0 ? 'Aucun utilisateur approuvé' : `${approved.length} utilisateur${approved.length > 1 ? 's' : ''}`}
              </p>
            </div>

            {approved.length === 0 ? (
              <div className="rounded-lg border border-border bg-card/30 p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun utilisateur approuvé pour le moment</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-card border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Utilisateur
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Rôle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Date d'approbation
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {approved.map((user) => (
                        <tr key={user.id} className="hover:bg-card/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-[10px] text-muted-foreground">{user.id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-sm bg-primary/10 text-primary">
                              {user.role === 'chef-de-bloc' ? 'Chef de bloc'
                               : user.role === 'chef-de-quart' ? 'Chef de quart'
                               : user.role === 'admin' ? 'Admin'
                               : 'Utilisateur'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[10px] text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-secondary" />
                              <span className="text-[10px] font-bold text-secondary uppercase">Approuvé</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}