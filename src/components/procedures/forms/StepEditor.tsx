"use client";

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Clock, 
  ShieldAlert,
  Layers,
  Settings2,
  Activity,
  Info
} from 'lucide-react';
import { ProcedureStep } from '@/lib/procedures/types';

interface StepEditorProps {
  steps: ProcedureStep[];
  onChange: (steps: any[]) => void;
}

export function StepEditor({ steps, onChange }: StepEditorProps) {
  const addStep = () => {
    const newStep: any = {
      id: `step-${Date.now()}`,
      order: steps.length + 1,
      title: '',
      subtitle: '',
      description: '',
      duration: { value: 60, unit: 'seconds', display: '1 min', type: 'fixed' },
      action: { 
        type: 'confirmation', 
        instruction: '', 
        ui: { component: 'action_button', label: 'Confirmer', icon: 'check' } 
      },
      validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 120, unit: 'seconds', action: 'warn' } },
      dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true }
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const next = [...steps];
    next.splice(index, 1);
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateStep = (index: number, updates: any) => {
    const next = [...steps];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-secondary" />
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Séquençage Opérationnel ({steps.length})
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={addStep} className="h-8 text-[9px] uppercase border-border font-bold">
          <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une Séquence
        </Button>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <Card key={step.id} className="border-border bg-card/20 overflow-hidden group shadow-xl">
            {/* Header d'étape */}
            <div className="p-3 border-b border-border bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-move" />
                <span className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[10px] font-bold text-secondary font-code">
                  {index + 1}
                </span>
                <Input 
                  value={step.title}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                  placeholder="TITRE DE L'ACTION (EX: MISE SOUS TENSION)"
                  className="h-8 bg-transparent border-none focus-visible:ring-0 font-headline font-bold uppercase text-xs w-full max-w-md"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/20 rounded-sm border border-border/50">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <Input 
                    value={step.duration.value}
                    onChange={(e) => updateStep(index, { duration: { ...step.duration, value: parseInt(e.target.value) || 0, display: `${e.target.value}s` } })}
                    className="w-10 h-6 bg-transparent border-none p-0 text-center text-[10px] font-code text-primary"
                  />
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">SEC</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeStep(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Contenu d'étape */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Description & Instruction */}
                <div className="space-y-4">
                   <div>
                     <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest block mb-2">Description de la Séquence</label>
                     <Textarea 
                       value={step.description}
                       onChange={(e) => updateStep(index, { description: e.target.value })}
                       className="bg-black/40 border-border font-code text-[11px] h-24 resize-none"
                       placeholder="DÉTAILLER L'OPÉRATION TECHNIQUE POUR L'OPÉRATEUR..."
                     />
                   </div>
                   <div>
                     <label className="text-[9px] font-bold uppercase text-primary tracking-widest block mb-2">Sous-Titre de Phase</label>
                     <Input 
                       value={step.subtitle || ''}
                       onChange={(e) => updateStep(index, { subtitle: e.target.value })}
                       className="bg-black/40 border-border font-code text-[10px] uppercase h-9"
                       placeholder="EX: ÉQUILIBRAGE DES PRESSIONS"
                     />
                   </div>
                </div>

                {/* Configuration Action */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Configuration de l'Action</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold text-muted-foreground uppercase">Type d'Action</label>
                      <Select 
                        value={step.action.type} 
                        onValueChange={(val) => updateStep(index, { action: { ...step.action, type: val as any } })}
                      >
                        <SelectTrigger className="h-8 bg-black/40 text-[9px] uppercase font-bold border-primary/20">
                          <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="confirmation">CONFIRMATION</SelectItem>
                          <SelectItem value="valve_operation">VANNE / VALVE</SelectItem>
                          <SelectItem value="command">COMMANDE SYSTÈME</SelectItem>
                          <SelectItem value="wait">ATTENTE / STABILISATION</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {step.action.type === 'valve_operation' && (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                        <label className="text-[8px] font-bold text-primary uppercase">Cible (%)</label>
                        <Input 
                          type="number"
                          value={step.action.target || 0}
                          onChange={(e) => updateStep(index, { action: { ...step.action, target: parseInt(e.target.value) || 0 } })}
                          className="h-8 bg-black/60 border-primary/40 text-center font-code text-xs text-primary"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase">Libellé du Bouton (UI)</label>
                    <Input 
                      value={step.action.ui.label}
                      onChange={(e) => updateStep(index, { action: { ...step.action, ui: { ...step.action.ui, label: e.target.value } } })}
                      className="h-8 bg-black/40 border-border text-[9px] uppercase font-bold"
                      placeholder="CONFIRMER"
                    />
                  </div>
                </div>
              </div>

              {/* Validation & Alarmes Footer */}
              <div className="pt-4 border-t border-border/50 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
                    <Activity className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-[9px] font-bold text-secondary uppercase">Validation : {step.action.type === 'valve_operation' ? 'Automatique' : 'Manuelle'}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-destructive/10 border border-destructive/20 rounded-sm opacity-50">
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-[9px] font-bold text-destructive uppercase">Alarme : Non configurée</span>
                  </div>
                </div>
                
                <Button variant="ghost" size="sm" className="h-7 text-[8px] font-bold uppercase tracking-tighter hover:bg-primary/5">
                   <Plus className="w-3 h-3 mr-1" /> Ajouter une condition de monitoring
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {steps.length === 0 && (
          <div className="py-20 border-2 border-dashed border-border/30 rounded-lg flex flex-col items-center justify-center text-center opacity-30">
            <Plus className="w-12 h-12 mb-4 text-muted-foreground" />
            <p className="font-code text-sm uppercase tracking-[0.2em] px-10">Aucune séquence opérationnelle. Démarrez la forge industrielle.</p>
          </div>
        )}
      </div>
    </div>
  );
}
