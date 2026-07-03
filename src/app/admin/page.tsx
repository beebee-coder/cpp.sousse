"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/dashboard/Sidebar';
import { CheckCircle2, XCircle, Clock, Users, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [role, setRole] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<User[]>([]);
  const [approved, setApproved] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch('/api/auth/me');
        const sessionData = await sessionResponse.json();
        const userRole = (sessionData.session?.user as any)?.role as string | undefined;
        setRole(userRole);

        if (userRole !== 'admin') {
          router.replace('/dashboard');
          return;
        }

        const response = await fetch('/api/auth/admin');
        
        // ✅ Sécurisation du parsing JSON
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType?.includes('application/json')) {
          const text = await response.text();
          console.error("❌ [ADMIN_API] Erreur liaison :", text.slice(0, 100));
          throw new Error(`Erreur serveur (${response.status}). Liaison base de données corrompue.`);
        }

        const data = await response.json();
        setPending(data.pending || []);
        setApproved(data.users || []);
        setStats(data.stats || { total: 0, approved: 0, pending: 0 });
      } catch (err: any) {
        setError(err.message);
        toast({ title: "Audit Échoué", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router, toast]);

  const handleApprove = async (userId: string) => {
    setActionInProgress(userId);
    try {
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
        toast({ title: "Accès Accordé", description: "L'utilisateur est désormais accrédité." });
      } else {
        throw new Error("Échec de l'approbation système.");
      }
    } catch (e: any) {
      toast({ title: "Erreur Critique", description: e.message, variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActionInProgress(userId);
    try {
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reject' }),
      });

      if (response.ok) {
        setPending((current) => current.filter((user) => user.id !== userId));
        setStats((current) => ({ ...current, pending: current.pending - 1 }));
        toast({ title: "Accès Révoqué", description: "La demande a été supprimée du registre." });
      }
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-code text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">Lecture du Registre d'Accréditation...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-lg font-headline font-bold uppercase mb-2">Rupture de Liaison</h2>
          <p className="text-xs font-code text-muted-foreground uppercase max-w-md">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-primary text-primary-foreground font-bold uppercase text-[10px] rounded-sm">Réessayer</button>
        </main>
      </div>
    );
  }

  if (role !== 'admin') return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <h1 className="font-headline font-bold text-xs uppercase tracking-widest">Gestionnaire d'Accréditations</h1>
              <p className="text-[9px] font-code text-muted-foreground uppercase">Audit des accès certifiés CCP</p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Registre</p>
              <p className="text-3xl font-headline font-bold text-primary">{stats.total}</p>
              <div className="mt-2 h-1 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(stats.approved / (stats.total || 1)) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">En Attente Audit</p>
              <p className="text-3xl font-headline font-bold text-amber-500">{stats.pending}</p>
            </div>

            <div className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Accrédités</p>
              <p className="text-3xl font-headline font-bold text-secondary">{stats.approved}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-[11px] font-headline font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Demandes d'Accès Récentes
            </h2>

            {pending.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border p-8 text-center bg-muted/5">
                <CheckCircle2 className="w-10 h-10 text-secondary/30 mx-auto mb-3" />
                <p className="text-[10px] font-code text-muted-foreground uppercase">Tous les profils sont audités.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pending.map((user) => (
                  <div key={user.id} className="rounded-sm border border-border bg-black/40 p-4 hover:border-primary/30 transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-headline font-bold uppercase text-sm text-white">{user.firstName} {user.lastName}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                           <span className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary text-[8px] font-bold uppercase border border-primary/20">
                             Rôle : {user.role}
                           </span>
                           <span className="px-2 py-0.5 rounded-sm bg-muted text-muted-foreground text-[8px] font-bold uppercase border border-border">
                             ID : {user.id.slice(0, 8)}
                           </span>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={actionInProgress === user.id}
                          className="flex items-center gap-2 h-9 px-4 rounded-sm bg-secondary text-secondary-foreground text-[9px] font-bold uppercase shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                        >
                          {actionInProgress === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Approuver
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          disabled={actionInProgress === user.id}
                          className="flex items-center gap-2 h-9 px-4 rounded-sm bg-destructive/10 text-destructive border border-destructive/20 text-[9px] font-bold uppercase hover:bg-destructive/20 disabled:opacity-50 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Rejeter
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-6">
            <h2 className="text-[11px] font-headline font-bold uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
              Registre des Opérateurs Certifiés
            </h2>

            <div className="rounded-sm border border-border overflow-hidden bg-card/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black/40 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Opérateur</th>
                      <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Accréditation</th>
                      <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Date Liaison</th>
                      <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {approved.map((user) => (
                      <tr key={user.id} className="hover:bg-primary/5 transition-colors font-code">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold uppercase text-white">{user.firstName} {user.lastName}</p>
                          <p className="text-[8px] text-muted-foreground uppercase">{user.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase rounded-sm bg-muted text-primary border border-primary/20">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[9px] text-muted-foreground uppercase">
                          {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-secondary" />
                            <span className="text-[9px] font-bold text-secondary uppercase">Actif</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
