"use client";

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  GripVertical,
  Trash2,
  Clock,
  ShieldAlert,
  Layers,
  Settings2,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { ProcedureStep } from '@/lib/procedures/types';
import {
  ACTION_TYPES,
  VALIDATION_TYPES,
  ALARM_TYPES,
  ALARM_SEVERITIES,
  TIMEOUT_ACTIONS,
  VALVE_OPERATIONS,
  SPEED_MODES,
} from '@/lib/procedures/config';

type StepField = 'title' | 'description' | 'subtitle' | 'duration' | 'actionType' | 'actionTarget' | 'actionLabel';

interface StepEditorProps {
  steps: ProcedureStep[];
  onChange: (steps: any[]) => void;
  activeStepIndex?: number;
  activeStepField?: StepField;
  onFieldFocus?: (stepIndex: number, field: StepField) => void;
  applyVoiceValue?: (stepIndex: number, field: StepField, text: string) => void;
  clearVoiceField?: (stepIndex: number, field: StepField) => void;
  defaults?: {
    defaultActionType: string;
    defaultValidationType: string;
    defaultAlarmType: string;
    defaultAlarmSeverity: string;
    defaultTimeoutAction: string;
    defaultValveOperation: string;
    defaultSpeedMode: string;
    defaultDuration: number;
    defaultUiLabel: string;
    defaultSuccessExpression: string;
  };
  createStep?: () => ProcedureStep;
  onSyncStepWithDefaults?: (index: number) => void;
}

export function StepEditor({
  steps,
  onChange,
  activeStepIndex = 0,
  activeStepField = 'title',
  onFieldFocus,
  applyVoiceValue,
  clearVoiceField,
  defaults,
  createStep,
  onSyncStepWithDefaults,
}: StepEditorProps) {
  const addStep = () => {
    const newStep = createStep
      ? createStep()
      : {
          id: `step-${Date.now()}`,
          order: steps.length + 1,
          title: '',
          subtitle: '',
          description: '',
          duration: { value: 60, unit: 'seconds', display: '1 min', type: 'fixed' as const },
          action: { type: 'confirmation', instruction: '', parameters: {}, ui: { component: 'action_button', label: 'Confirmer', icon: 'check' } },
          validation: { conditions: [], successExpression: 'status == OK', timeout: { value: 120, unit: 'seconds', action: 'warn' as const } },
          alarms: [],
          fallbacks: [],
          media: {},
          notes: [],
          dependencies: { prerequisites: [], dependsOn: [], requiresConfirmation: true },
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

  const isActive = (stepIndex: number, field: StepField) => stepIndex === activeStepIndex && activeStepField === field;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-secondary" />
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Séquençage Opérationnel</h3>
            <span className="px-2 py-0.5 bg-secondary/10 border border-secondary/30 rounded-sm text-[10px] font-code text-secondary font-bold">
              {steps.length} {steps.length === 1 ? 'étape' : 'étapes'}
            </span>
            {defaults && (
              <div className="hidden md:flex items-center gap-2 px-2 py-1 bg-muted/10 border border-border/40 rounded-sm">
                <Settings2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] font-code text-muted-foreground uppercase">Config : {defaults.defaultActionType || 'Aucune'}</span>
                {defaults.defaultDuration ? (
                  <span className="text-[9px] font-code text-muted-foreground/70 uppercase">/ {defaults.defaultDuration}s</span>
                ) : null}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={addStep} className="h-8 text-[9px] uppercase border-border font-bold">
            <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une Séquence
          </Button>
        </div>

        <div className="space-y-6">
          {steps.map((step, index) => {
            const versionKey = [
              step.action?.type || 'none',
              step.validation?.conditions?.[0]?.type || 'none',
              step.alarms?.[0]?.type || 'none',
              step.alarms?.[0]?.severity || 'none',
              step.duration?.value || 0,
              step.action?.ui?.label || '',
              step.action?.operation || '',
              step.action?.speed || '',
            ].join('|');

            return (
              <Card
                key={`${step.id}-${versionKey}`}
                className={`border bg-card/20 overflow-hidden group shadow-xl ${isActive(index, 'title') || isActive(index, 'description') || isActive(index, 'subtitle') || isActive(index, 'actionType') || isActive(index, 'actionTarget') || isActive(index, 'actionLabel') || isActive(index, 'duration') ? 'border-primary/60' : 'border-border'}`}
              >
                <div className="p-3 border-b border-border bg-black/40 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-move" />
                    <span className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-[10px] font-bold text-secondary font-code">{index + 1}</span>
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, { title: e.target.value })}
                      onFocus={() => onFieldFocus?.(index, 'title')}
                      placeholder="TITRE DE L'ACTION (EX: MISE SOUS TENSION)"
                      className={`h-8 bg-transparent border-none focus-visible:ring-0 font-headline font-bold uppercase text-xs w-full max-w-md ${isActive(index, 'title') ? 'text-primary' : ''}`}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2">
                      {step.action?.type ? (
                        <Badge variant="outline" className="text-[8px] font-code border-primary/40 text-primary uppercase">{step.action.type}</Badge>
                      ) : null}
                      {step.alarms?.[0]?.type ? (
                        <Badge variant="outline" className="text-[8px] font-code border-destructive/40 text-destructive uppercase">{step.alarms[0].type}</Badge>
                      ) : null}
                      {step.duration?.value ? (
                        <span className="text-[9px] font-code text-muted-foreground uppercase">{step.duration.value}s</span>
                      ) : null}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onSyncStepWithDefaults?.(index)}
                          className="h-8 w-8 text-muted-foreground hover:text-secondary transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-[9px] font-code uppercase">Synchroniser cette étape avec la Configuration</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button variant="ghost" size="icon" onClick={() => removeStep(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest block mb-2">Description de la Séquence</label>
                        <Textarea
                          value={step.description}
                          onChange={(e) => updateStep(index, { description: e.target.value })}
                          onFocus={() => onFieldFocus?.(index, 'description')}
                          className={`bg-black/40 font-code text-[11px] h-24 resize-none ${isActive(index, 'description') ? 'border-primary' : 'border-border'}`}
                          placeholder="DÉTAILLER L'OPÉRATION TECHNIQUE POUR L'OPÉRATEUR..."
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase text-primary tracking-widest block mb-2">Sous-Titre de Phase</label>
                        <Input
                          value={step.subtitle || ''}
                          onChange={(e) => updateStep(index, { subtitle: e.target.value })}
                          onFocus={() => onFieldFocus?.(index, 'subtitle')}
                          className={`bg-black/40 border font-code text-[10px] uppercase h-9 ${isActive(index, 'subtitle') ? 'border-primary' : 'border-border'}`}
                          placeholder="EX: ÉQUILIBRAGE DES PRESSIONS"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-sm space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings2 className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Configuration de l'Action</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Type d'Action</label>
                          <Select
                            value={step.action?.type || ''}
                            onValueChange={(val) => updateStep(index, { action: { ...(step.action || {}), type: val as any } })}
                          >
                            <SelectTrigger className={`h-8 bg-black/40 text-[9px] uppercase font-bold ${isActive(index, 'actionType') ? 'border-primary' : 'border-primary/20'}`}>
                              <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border">
                              <SelectItem value="">Aucun</SelectItem>
                              {ACTION_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {step.action?.type === 'valve_operation' && (
                          <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                            <label className="text-[8px] font-bold text-primary uppercase">Opération vanne</label>
                            <Select
                              value={step.action?.operation || defaults?.defaultValveOperation || 'open'}
                              onValueChange={(val) => updateStep(index, { action: { ...(step.action || {}), operation: val as any } })}
                            >
                              <SelectTrigger className={`h-8 bg-black/40 text-[9px] uppercase font-bold ${isActive(index, 'actionTarget') ? 'border-primary' : 'border-primary/40'}`}>
                                <SelectValue placeholder="Opération" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border">
                                <SelectItem value="">Aucun</SelectItem>
                                {VALVE_OPERATIONS.map((op) => (
                                  <SelectItem key={op} value={op}>{op}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {step.action?.type === 'valve_operation' && (
                          <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                            <label className="text-[8px] font-bold text-primary uppercase">Vitesse</label>
                            <Select
                              value={step.action?.speed || defaults?.defaultSpeedMode || 'progressive'}
                              onValueChange={(val) => updateStep(index, { action: { ...(step.action || {}), speed: val as any } })}
                            >
                              <SelectTrigger className={`h-8 bg-black/40 text-[9px] uppercase font-bold ${isActive(index, 'actionTarget') ? 'border-primary' : 'border-primary/40'}`}>
                                <SelectValue placeholder="Vitesse" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border">
                                <SelectItem value="">Aucun</SelectItem>
                                {SPEED_MODES.map((mode) => (
                                  <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-muted-foreground uppercase">Durée (s)</label>
                        <Input
                          type="number"
                          value={step.duration?.value || 60}
                          onChange={(e) => updateStep(index, { duration: { ...(step.duration || {}), value: parseInt(e.target.value) || 60, display: `${e.target.value}s` } })}
                          onFocus={() => onFieldFocus?.(index, 'duration')}
                          className={`h-8 bg-black/40 text-center font-code text-xs ${isActive(index, 'duration') ? 'border-primary text-primary' : 'border-border'}`}
                          placeholder="60"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-muted-foreground uppercase">Libellé du Bouton (UI)</label>
                        <Input
                          value={step.action?.ui?.label || ''}
                          onChange={(e) => updateStep(index, { action: { ...(step.action || {}), ui: { ...(step.action?.ui || {}), label: e.target.value } } })}
                          onFocus={() => onFieldFocus?.(index, 'actionLabel')}
                          className={`h-8 bg-black/40 text-[9px] uppercase font-bold ${isActive(index, 'actionLabel') ? 'border-primary' : 'border-border'}`}
                          placeholder="CONFIRMER"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-[8px] font-bold text-muted-foreground uppercase">Type de validation</label>
                        <Select
                          value={step.validation?.conditions?.[0]?.type || defaults?.defaultValidationType || 'status'}
                          onValueChange={(val) => {
                            const conditions = [...(step.validation?.conditions || [])];
                            if (conditions.length === 0) {
                              conditions.push({ id: `val-${Date.now()}`, type: val, operator: '==', value: 0, description: '', displayName: '' });
                            } else {
                              conditions[0] = { ...conditions[0], type: val };
                            }
                            updateStep(index, { validation: { ...(step.validation || {}), conditions } });
                          }}
                        >
                          <SelectTrigger className="h-7 bg-black/40 text-[9px] uppercase font-bold border-border">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-border">
                            <SelectItem value="">Aucun</SelectItem>
                            {VALIDATION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
                        <Activity className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-[9px] font-bold text-secondary uppercase">Validation : {step.action?.type === 'valve_operation' ? 'Automatique' : 'Manuelle'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[8px] font-bold text-muted-foreground uppercase">Type alarme</label>
                        <Select
                          value={step.alarms?.[0]?.type || defaults?.defaultAlarmType || 'warning'}
                          onValueChange={(val) => {
                            const alarms = [...(step.alarms || [])];
                            if (alarms.length === 0) {
                              alarms.push({
                                id: `alarm-${Date.now()}`,
                                code: `ALM-${Date.now()}`,
                                type: val as any,
                                severity: (defaults?.defaultAlarmSeverity as any) || 'medium',
                                description: '',
                                condition: '',
                                remedy: { title: '', description: '', steps: [], estimatedTime: 0 },
                                escalation: { ifPersistsAfter: 1, contact: '', message: '' },
                              });
                            } else {
                              alarms[0] = { ...alarms[0], type: val as any };
                            }
                            updateStep(index, { alarms });
                          }}
                        >
                          <SelectTrigger className="h-7 bg-black/40 text-[9px] uppercase font-bold border-border">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-border">
                            <SelectItem value="">Aucun</SelectItem>
                            {ALARM_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {steps.length === 0 && (
            <div className="py-20 border-2 border-dashed border-border/30 rounded-lg flex flex-col items-center justify-center text-center opacity-30">
              <Plus className="w-12 h-12 mb-4 text-muted-foreground" />
              <p className="font-code text-sm uppercase tracking-[0.2em] px-10">Aucune séquence opérationnelle. Démarrez la forge industrielle.</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
