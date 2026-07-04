'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  FileText, 
  Save, 
  Search, 
  Layers, 
  Mic, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, CardContent as TabContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Interface pour les étapes de procédure industrielle (Standard CRF).
 */
interface ProcedureStep {
  id: string;
  order: number;
  title: string;
  description: string;
}

/**
 * STATION DE FORGE - DATASET & RAG
 * Cette station permet de structurer les connaissances industrielles avant injection vectorielle.
 * ✅ BLINDAGE V26.0 : Correction définitive du bug de sérialisation [object Event].
 */
export default function ForgeStation() {
  const { toast } = useToast();
  const [isSaving, setIsSyncing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Opérationnel');
  const [steps, setSteps] = useState<ProcedureStep[]>([
    { id: 'step-1', order: 1, title: '', description: '' }
  ]);

  // Initialisation stable des IDs pour l'hydratation
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /**
   * ✅ GESTIONNAIRE BLINDÉ ANTI-CORRUPTION [object Event]
   * Extrait systématiquement la valeur brute pour empêcher les objets React complexes 
   * de polluer l'état et de corrompre le JSON final.
   */
  const handleUpdateStepField = useCallback((
    id: string, 
    field: keyof ProcedureStep, 
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string
  ) => {
    // 1. Détection et extraction de la valeur primitive (string)
    let rawValue: string = '';
    
    if (typeof e === 'string') {
      rawValue = e;
    } else if (e && e.target) {
      rawValue = e.target.value;
    } else {
      // Cas de fallback pour éviter le stockage de [object Object]
      console.warn(`[FORGE] Valeur non identifiée capturée pour le champ ${field}.`);
      return;
    }

    // 2. Filtrage de sécurité pour éradiquer le bug récurrent
    if (rawValue === "[object Event]") {
       console.error("[FORGE] Tentative de sérialisation d'un objet Event bloquée.");
       return;
    }

    // 3. Mise à jour atomique de l'état
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, [field]: rawValue } : step
    ));
  }, []);

  const addStep = () => {
    const newOrder = steps.length + 1;
    setSteps([...steps, { 
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
      order: newOrder, 
      title: '', 
      description: '' 
    }]);
  };

  const removeStep = (id: string) => {
    if (steps.length === 1) return;
    const filtered = steps.filter(s => s.id !== id);
    const reordered = filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    setSteps(reordered);
  };

  const handleSave = async () => {
    if (!title) {
      toast({ variant: "destructive", title: "Audit Error", description: "Le titre de la procédure est requis." });
      return;
    }

    setIsSyncing(true);
    try {
      // Simulation d'une injection API vers le registre
      await new Promise(r => setTimeout(r, 1200));
      
      console.log("🚀 [FORGE] Injection JSON structurelle :", { title, description, category, steps });
      
      toast({ title: "Forge Success", description: "La procédure a été structurée et injectée dans le registre RAG." });
      
      // Reset
      setTitle('');
      setDescription('');
      setSteps([{ id: 'step-1', order: 1, title: '', description: '' }]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Forge Failure", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-background/95">
      <div className="p-6 space-y-6">
        {/* Header Technique */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-headline font-bold flex items-center gap-3">
              <Layers className="w-6 h-6 text-primary" />
              STATION DE FORGE RAG
              <Badge variant="outline" className="text-[10px] ml-2 border-primary/30 text-primary">V26.0 STABLE</Badge>
            </h1>
            <p className="text-sm text-muted-foreground font-code uppercase">Structuration du Registre de Connaissances Industrielles</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 border-border/50">
              <RefreshCw className="w-3.5 h-3.5" />
              RE-SYNC
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-primary hover:bg-primary/90 text-background font-bold">
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              INJECTER DANS LE NOYAU
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Metadata & Config */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <Card className="border-border/40 bg-card/50 shadow-xl overflow-hidden">
              <div className="h-1 w-full bg-primary/20" />
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" /> Configuration
                </CardTitle>
                <CardDescription className="text-xs uppercase font-code">Métadonnées de la procédure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Titre de l'Opération</Label>
                  <Input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Maintenance Pompe P-102"
                    className="bg-background border-border/40 focus:border-primary/50 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Catégorie Industrielle</Label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-md border border-border/40 bg-background text-sm outline-none focus:border-primary/50 transition-colors"
                  >
                    <option>Sécurité</option>
                    <option>Opérationnel</option>
                    <option>Mise en service</option>
                    <option>Urgence</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Contexte Global</Label>
                  <Textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description technique du processus..."
                    className="bg-background border-border/40 min-h-[100px] text-sm resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-muted/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded bg-primary/10">
                    <Code className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold">Standard CRF-JSON</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Chaque étape est structurée pour être lisible par le moteur d'audit IA et le système RAG.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Steps Forge */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-primary" /> Séquençage de la Procédure
              </h3>
              <Button variant="ghost" size="sm" onClick={addStep} className="h-8 gap-2 text-primary hover:text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4" /> AJOUTER UNE ÉTAPE
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)] pr-4">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <Card key={step.id} className="border-border/30 bg-card/30 group transition-all hover:border-primary/30">
                    <CardContent className="p-0">
                      <div className="flex">
                        <div className="w-12 bg-muted/30 flex flex-col items-center pt-4 border-r border-border/20">
                          <span className="text-lg font-code font-bold text-primary/70">{step.order}</span>
                        </div>
                        <div className="flex-1 p-4 space-y-4">
                          <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">Instruction Courte</Label>
                              <Input 
                                value={step.title}
                                // ✅ PASSAGE DE L'ÉVÉNEMENT AU GESTIONNAIRE BLINDÉ
                                onChange={(e) => handleUpdateStepField(step.id, 'title', e)}
                                placeholder="ex: Vérification vannes d'isolement"
                                className="bg-transparent border-none border-b border-border/40 rounded-none h-8 px-0 focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-bold"
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeStep(step.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground/70">Description de l'Action</Label>
                            <Textarea 
                              value={step.description}
                              // ✅ PASSAGE DE L'ÉVÉNEMENT AU GESTIONNAIRE BLINDÉ
                              onChange={(e) => handleUpdateStepField(step.id, 'description', e)}
                              placeholder="Détaillez la procédure technique pour cette étape..."
                              className="bg-transparent border-border/20 min-h-[60px] text-xs resize-none focus:border-primary/30"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
