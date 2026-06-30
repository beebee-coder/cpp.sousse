"use client";

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Clock, 
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp
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
      validation: { conditions: [], successExpression: '', timeout: { value: 120, unit: 'seconds', action: 'warn' } },
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
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Layers className="w-4 h-4 text-secondary" />
          Séquence Opérationnelle ({steps.length})
        </h3>
        <Button variant="outline" size="sm" onClick={addStep} className="h-8 text-[9px] uppercase border-border font-bold">
          <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter Étape
        </Button>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.id} className="border-border bg-card/20 overflow-hidden group">
            {/* Header d'étape */}
            <div className="p-3 border-b border-border bg-black/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-move" />
                <span className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[10px] font-bold text-secondary">
                  {index + 1}
                </span>
                <Input 
                  value={step.title}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                  placeholder="TITRE DE L'ACTION (EX: LAVAGE GRILLE)..."
                  className="h-8 bg-transparent border-none focus-visible:ring-0 font-headline font-bold uppercase text-xs w-[300px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/20 rounded-sm">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <Input 
                    value={step.duration.value}
                    onChange={(e) => updateStep(index, { duration: { ...step.duration, value: parseInt(e.target.value) || 0 } })}
                    className="w-12 h-6 bg-transparent border-none p-0 text-center text-[10px] font-code"
                  />
                  <span className="text-[9px] font-code text-muted-foreground uppercase">SEC</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeStep(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Contenu d'étape */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Instructions détaillées</label>
                  <Textarea 
                    value={step.description}
                    onChange={(e) => updateStep(index, { description: e.target.value })}
                    className="bg-black/20 border-border font-code text-[11px] h-24"
                    placeholder="DÉTAILLER L'OPÉRATION TECHNIQUE..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-sm">
                    <p className="text-[8px] font-bold text-primary uppercase mb-2">Composant UI</p>
                    <div className="text-[10px] font-code text-white/70 uppercase">Action Button</div>
                  </div>
                  <div className="p-3 bg-secondary/5 border border-secondary/20 rounded-sm">
                    <p className="text-[8px] font-bold text-secondary uppercase mb-2">Validation</p>
                    <div className="text-[10px] font-code text-white/70 uppercase">Manuelle</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-l border-border/50 pl-6">
                <div className="flex items-start gap-3 p-3 bg-black/40 rounded-sm border border-dashed border-border">
                  <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] font-bold uppercase text-destructive mb-1">Configuration Alarme</p>
                    <p className="text-[8px] font-code text-muted-foreground uppercase">Aucune alarme critique définie pour cette étape.</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full h-8 border border-border text-[9px] uppercase font-bold">
                  <Plus className="w-3 h-3 mr-2" /> Gérer Alarmes & Fallbacks
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {steps.length === 0 && (
          <div className="py-12 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center opacity-30">
            <Plus className="w-12 h-12 mb-3" />
            <p className="font-code text-xs uppercase tracking-widest px-10">Aucune étape définie. Commencez le séquençage industriel.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { Layers } from 'lucide-react';
