"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  ChevronUp,
  ChevronDown,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Crown,
  ClipboardList,
  User as UserIcon,
  ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Role } from '@prisma/client';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  approved: boolean;
  createdAt: number;
}

interface Stats {
  total: number;
  byRole: Record<string, number>;
  pending: number;
  approved: number;
}

type SortField = 'name' | 'email' | 'role' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  chef_de_bloc: 'Chef de Bloc',
  chef_de_quart: 'Chef de Quart',
  user: 'Utilisateur',
};

const ROLE_ICONS: Record<string, any> = {
  admin: Crown,
  chef_de_bloc: ShieldCheck,
  chef_de_quart: ClipboardList,
  user: UserIcon,
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-primary border-primary/30 bg-primary/10',
  chef_de_bloc: 'text-secondary border-secondary/30 bg-secondary/10',
  chef_de_quart: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  user: 'text-muted-foreground border-border bg-muted/10',
};

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const sessionResponse = await fetch('/api/auth/me');
      const sessionData = await sessionResponse.json();
      const userRole = (sessionData.session?.user as any)?.role as string | undefined;
      setRole(userRole);

      if (userRole !== 'admin') {
        router.replace('/dashboard');
        return;
      }

      const response = await fetch('/api/auth/users');
      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType?.includes('application/json')) {
        throw new Error(`Rupture de liaison API (${response.status}).`);
      }

      const data = await response.json();
      setUsers(data.users || []);
      setStats(data.stats || null);
    } catch (err: any) {
      toast({ title: "Audit Échoué", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [router, toast]);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    if (statusFilter === 'pending') {
      result = result.filter(u => !u.approved);
    } else if (statusFilter === 'approved') {
      result = result.filter(u => u.approved);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'email':
          cmp = a.email.localeCompare(b.email);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'status':
          cmp = Number(a.approved) - Number(b.approved);
          break;
        case 'createdAt':
          cmp = a.createdAt - b.createdAt;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, searchQuery, roleFilter, statusFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleEditRole = async () => {
    if (!editUser || !editRole) return;
    setEditLoading(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editUser.id, role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de la modification');
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, role: editRole } : u));
      toast({ title: "Rôle Modifié", description: `Rôle mis à jour vers ${ROLE_LABELS[editRole] || editRole}.` });
      setEditUser(null);
      setEditRole(null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleApproval = async (userId: string, currentApproved: boolean) => {
    setActionInProgress(userId);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved: !currentApproved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: !currentApproved } : u));
      toast({ title: currentApproved ? "Accès Révoqué" : "Accès Accordé", description: currentApproved ? "L'utilisateur a été désapprouvé." : "L'utilisateur est désormais accrédité." });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de la suppression');
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      toast({ title: "Utilisateur Supprimé", description: "Le compte a été retiré du registre." });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-transparent">
        <main className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-code text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">Lecture du Registre Utilisateurs...</p>
        </main>
      </div>
    );
  }

  if (role !== 'admin') return null;

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <h1 className="font-headline font-bold text-xs uppercase tracking-widest">Gestionnaire d'Utilisateurs</h1>
              <p className="text-[9px] font-code text-muted-foreground uppercase">Console Admin · Rôles & Accès</p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total</p>
                <p className="text-3xl font-headline font-bold text-primary">{stats.total}</p>
              </Card>
              <Card className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Accrédités</p>
                <p className="text-3xl font-headline font-bold text-secondary">{stats.approved}</p>
              </Card>
              <Card className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">En Attente</p>
                <p className="text-3xl font-headline font-bold text-amber-500">{stats.pending}</p>
              </Card>
              <Card className="rounded-sm border border-border bg-card/50 p-4 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Par Rôle</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(stats.byRole).map(([r, c]) => (
                    <span key={r} className="text-[9px] font-code uppercase px-1.5 py-0.5 rounded-sm border border-border bg-muted/20">
                      {ROLE_LABELS[r] || r}: {c}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, email ou ID..."
                className="pl-9 bg-black/40 border-border font-code text-xs uppercase tracking-wide"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-black/40 border-border font-code text-xs uppercase">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-black/40 border-border font-code text-xs uppercase">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="approved">Accrédités</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="rounded-sm border border-border bg-black/20 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Utilisateur <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">
                      <button onClick={() => handleSort('email')} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Email <SortIcon field="email" />
                      </button>
                    </TableHead>
                    <TableHead className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">
                      <button onClick={() => handleSort('role')} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Rôle <SortIcon field="role" />
                      </button>
                    </TableHead>
                    <TableHead className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">
                      <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Statut <SortIcon field="status" />
                      </button>
                    </TableHead>
                    <TableHead className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">
                      <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Créé le <SortIcon field="createdAt" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right font-code text-[9px] uppercase tracking-widest text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="font-code text-[10px] uppercase text-muted-foreground">Aucun utilisateur correspondant.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const RoleIcon = ROLE_ICONS[user.role] || UserIcon;
                      return (
                        <TableRow key={user.id} className="border-border hover:bg-muted/10 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-primary uppercase">
                                  {user.firstName[0]}{user.lastName[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-headline font-bold text-sm text-white uppercase truncate">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-[9px] font-code text-muted-foreground truncate">ID: {user.id.slice(0, 12)}...</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-code text-xs text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase border", ROLE_COLORS[user.role] || ROLE_COLORS.user)}>
                              <RoleIcon className="w-3 h-3" />
                              {ROLE_LABELS[user.role] || user.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.approved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-secondary/10 text-secondary text-[9px] font-bold uppercase border border-secondary/20">
                                <CheckCircle2 className="w-3 h-3" /> Accrédité
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase border border-amber-500/20">
                                <Clock className="w-3 h-3" /> En attente
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-code text-[10px] text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditUser(user); setEditRole(user.role); }}
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                title="Modifier le rôle"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleApproval(user.id, user.approved)}
                                disabled={actionInProgress === user.id}
                                className={cn("h-8 w-8", user.approved ? "text-amber-500 hover:text-amber-500 hover:bg-amber-500/10" : "text-secondary hover:text-secondary hover:bg-secondary/10")}
                                title={user.approved ? "Désapprouver" : "Approuver"}
                              >
                                {actionInProgress === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (user.approved ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />)}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(user)}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="text-center py-4">
            <p className="text-[9px] font-code text-muted-foreground uppercase tracking-widest">
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} affiché{filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </main>

      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) { setEditUser(null); setEditRole(null); } }}>
        <DialogContent className="bg-card border-border shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-sm uppercase tracking-wide">Modifier le Rôle</DialogTitle>
            <DialogDescription className="font-code text-[10px] uppercase text-muted-foreground">
              {editUser ? `${editUser.firstName} ${editUser.lastName}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nouveau Rôle</label>
              <Select value={editRole || ''} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger className="bg-black/40 border-border font-code text-xs uppercase">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditUser(null); setEditRole(null); }} className="font-code text-[9px] uppercase border-border hover:bg-muted/50">
              Annuler
            </Button>
            <Button onClick={handleEditRole} disabled={editLoading || !editRole} className="bg-primary text-primary-foreground font-code text-[9px] uppercase hover:brightness-110">
              {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-card border-border shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-sm uppercase tracking-wide text-destructive">Confirmer la Suppression</DialogTitle>
            <DialogDescription className="font-code text-[10px] uppercase text-muted-foreground">
              Cette action est irréversible. L'utilisateur <span className="text-white font-bold">{deleteTarget?.firstName} {deleteTarget?.lastName}</span> sera définitivement retiré du registre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="font-code text-[9px] uppercase border-border hover:bg-muted/50">
              Annuler
            </Button>
            <Button onClick={handleDelete} disabled={deleteLoading} className="bg-destructive text-destructive-foreground font-code text-[9px] uppercase hover:brightness-110">
              {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Trash2 className="w-3.5 h-3.5 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
