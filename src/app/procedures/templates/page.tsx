"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { normalizeTemplateOptions, renderTemplateOptions } from '@/lib/procedures/options';

type Template = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  options: any;
  required: boolean;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_TYPES = ['text', 'number', 'boolean', 'select'];

const emptyForm = {
  name: '',
  type: 'text',
  description: '',
  required: false,
  optionsText: '',
};

export default function ProcedureTemplatesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchTemplates();
  }, []);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; items: Template[]; offline?: boolean; provider?: string }>('/api/procedure-config-fields');
      if (!res.success) throw new Error(res.error || 'Erreur de chargement des templates');
      setItems((res.items as Template[]) || []);
      if (res.offline) {
        setError(null);
        setOfflineNotice(`Source locale (${res.provider || 'Registre Physique'}) — les modifications sont hors-ligne.`);
      } else {
        setOfflineNotice(null);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des templates');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const parseOptions = (text: string): string[] | null => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length > 0 ? lines : null;
  };

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name: t.name,
      type: t.type,
      description: t.description ?? '',
      required: t.required,
      optionsText: renderTemplateOptions(t.options).map((o) => o.label).join('\n'),
    });
  };

  const save = async () => {
    if (!form.name || !form.type) {
      setError('Le nom et le type sont requis.');
      return;
    }
    if (form.type === 'select' && !form.optionsText.trim()) {
      setError('Un champ select nécessite au moins une option.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        description: form.description || null,
        required: form.required,
        options: form.type === 'select' ? parseOptions(form.optionsText) : null,
      };
      const res = editing
        ? await apiClient.patch<Template>(`/api/procedure-config-fields/${editing.id}`, payload)
        : await apiClient.post<Template>('/api/procedure-config-fields', payload);
      if (!res.success) throw new Error(res.error || 'Échec de l\'enregistrement');
      await fetchTemplates();
      startCreate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce template ? Les champs associés dans les procédures seront retirés.')) return;
    setError(null);
    try {
      const res = await apiClient.delete<{ success: boolean }>(`/api/procedure-config-fields/${id}`);
      if (!res.success) throw new Error(res.error || 'Échec de la suppression');
      await fetchTemplates();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-transparent overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border/70 bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/procedures')} className="h-8 w-8 text-muted-foreground hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Layers className="w-4 h-4 text-primary" />
            <span className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Bibliothèque de Templates</span>
          </div>
          <Button variant="outline" size="sm" className="h-9 text-[9px] uppercase border-border" onClick={fetchTemplates}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Actualiser
          </Button>
        </header>

        {offlineNotice && (
          <div className="px-6 lg:px-8 pt-4">
            <div className="p-2 border border-primary/30 bg-primary/10 rounded text-[10px] font-code text-primary flex items-center gap-2">
              <RefreshCw className="w-3 h-3" />
              {offlineNotice}
            </div>
          </div>
        )}

        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulaire */}
          <Card className="p-5 h-fit lg:col-span-1 border-primary/20 bg-black/30 space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {editing ? 'Modifier le template' : 'Nouveau template'}
            </h3>

            <div className="space-y-1.5">
              <label className="text-micro font-bold text-muted-foreground uppercase">Nom *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Pression de consigne"
                className="h-9 bg-black/40 text-[11px] border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-micro font-bold text-muted-foreground uppercase">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="h-9 w-full bg-black/40 text-[11px] border border-border rounded px-2"
              >
                {ALLOWED_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-micro font-bold text-muted-foreground uppercase">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-9 bg-black/40 text-[11px] border-border"
              />
            </div>

            {form.type === 'select' && (
              <div className="space-y-1.5">
                <label className="text-micro font-bold text-muted-foreground uppercase">Options (une par ligne)</label>
                <Textarea
                  value={form.optionsText}
                  onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                  placeholder={'Ouvert\nFermé\nMaintenance'}
                  className="bg-black/40 text-[11px] border-border min-h-[80px]"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-[11px] font-code text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm({ ...form, required: e.target.checked })}
                className="rounded border-border"
              />
              Champ requis
            </label>

            {error && (
              <div className="p-2 border border-destructive/40 bg-destructive/10 rounded text-[10px] font-code text-destructive flex items-center justify-between gap-2">
                <span>{error}</span>
                <Button variant="ghost" size="sm" className="h-6 text-[9px] uppercase border-border" onClick={fetchTemplates}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
                </Button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-primary text-primary-foreground font-bold uppercase text-[10px] h-9"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-2" />}
                {editing ? 'Enregistrer' : 'Créer'}
              </Button>
              {editing && (
                <Button variant="outline" onClick={startCreate} className="border-border text-muted-foreground text-[10px] uppercase h-9">
                  Annuler
                </Button>
              )}
            </div>
          </Card>

          {/* Liste */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="font-code text-xs uppercase tracking-widest">Chargement...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 border border-dashed border-border rounded-lg text-center">
                <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-sm font-code uppercase text-muted-foreground">Aucun template. Créez le premier champ de configuration.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((t) => (
                  <Card key={t.id} className="p-4 bg-black/30 border-border space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-code font-bold text-[12px] text-white truncate">{t.name}</span>
                          <Badge variant="outline" className="text-micro font-code uppercase">{t.type}</Badge>
                          {t.required && <Badge variant="outline" className="text-micro font-code uppercase text-destructive border-destructive/40">requis</Badge>}
                        </div>
                        {t.description && (
                          <p className="text-[10px] font-code text-muted-foreground mt-1 truncate">{t.description}</p>
                        )}
                      </div>
                    </div>

                    {t.type === 'select' && renderTemplateOptions(t.options).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {renderTemplateOptions(t.options).map((o) => (
                          <span key={o.value} className="text-micro font-code bg-secondary/10 text-secondary border border-secondary/30 rounded px-1.5 py-0.5">
                            {o.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-[9px] uppercase border-border" onClick={() => startEdit(t)}>
                        <Pencil className="w-3 h-3 mr-1" /> Éditer
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[9px] uppercase border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => remove(t.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
