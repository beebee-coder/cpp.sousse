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
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { ProcedureStep, ProcedureMedia } from '@/lib/procedures/types';
import { MediaCaptureField } from './MediaCaptureField';
import {
  ACTION_TYPES,
  VALIDATION_TYPES,
  ALARM_TYPES,
  ALARM_SEVERITIES,
  TIMEOUT_ACTIONS,
  VALVE_OPERATIONS,
  SPEED_MODES,
} from '@/lib/procedures/config';
import { apiClient } from '@/lib/api-client';

type StepField = 'title' | 'description' | 'subtitle' | 'duration' | 'actionType' | 'actionTarget' | 'actionLabel';

interface StepEditorProps {
  steps: ProcedureStep[];
  mediaLibrary?: ProcedureMedia[];
  onMediaLibraryChange?: (media: ProcedureMedia[]) => void;
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
    enableMedia: boolean;
  };
  createStep?: () => ProcedureStep;
  onSyncStepWithDefaults?: (index: number) => void;
}

export function StepEditor({
  steps,
  mediaLibrary = [],
  onMediaLibraryChange,
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
          mediaRefs: [],
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
                <span className="text-tiny font-code text-muted-foreground uppercase">Config : {defaults.defaultActionType || 'Aucune'}</span>
                {defaults.defaultDuration ? (
                  <span className="text-tiny font-code text-muted-foreground/70 uppercase">/ {defaults.defaultDuration}s</span>
                ) : null}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={addStep} className="h-8 text-tiny uppercase border-border font-bold">
            <Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une Séquence
          </Button>
        </div>

        {defaults?.enableMedia && onMediaLibraryChange && (
          <Card className="p-4 panel-card border-primary/30">
            <MediaCaptureField media={mediaLibrary} onChange={onMediaLibraryChange} />
          </Card>
        )}

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
                        <Badge variant="outline" className="text-micro font-code border-primary/40 text-primary uppercase">{step.action.type}</Badge>
                      ) : null}
                      {step.alarms?.[0]?.type ? (
                        <Badge variant="outline" className="text-micro font-code border-destructive/40 text-destructive uppercase">{step.alarms[0].type}</Badge>
                      ) : null}
                      {step.duration?.value ? (
                        <span className="text-tiny font-code text-muted-foreground uppercase">{step.duration.value}s</span>
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
                        <p className="text-tiny font-code uppercase">Synchroniser cette étape avec la Configuration</p>
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
                        <label className="text-tiny font-bold uppercase text-muted-foreground tracking-widest block mb-2">Description de la Séquence</label>
                        <Textarea
                          value={step.description}
                          onChange={(e) => updateStep(index, { description: e.target.value })}
                          onFocus={() => onFieldFocus?.(index, 'description')}
                          className={`bg-black/40 font-code text-[11px] h-24 resize-none ${isActive(index, 'description') ? 'border-primary' : 'border-border'}`}
                          placeholder="DÉTAILLER L'OPÉRATION TECHNIQUE POUR L'OPÉRATEUR..."
                        />
                      </div>
                      <div>
                        <label className="text-tiny font-bold uppercase text-primary tracking-widest block mb-2">Sous-Titre de Phase</label>
                        <Input
                          value={step.subtitle || ''}
                          onChange={(e) => updateStep(index, { subtitle: e.target.value })}
                          onFocus={() => onFieldFocus?.(index, 'subtitle')}
                          className={`bg-black/40 border font-code text-[10px] uppercase h-9 ${isActive(index, 'subtitle') ? 'border-primary' : 'border-border'}`}
                          placeholder="EX: ÉQUILIBRAGE DES PRESSIONS"
                        />
                      </div>
                    </div>

                    <div className="p-4 info-card space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings2 className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Configuration de l'Action</span>
                      </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-micro font-bold text-muted-foreground uppercase">Type d'Action</label>
                          <Select
                            value={step.action?.type || ''}
                            onValueChange={(val) => updateStep(index, { action: { ...(step.action || {}), type: val as any } })}
                          >
                            <SelectTrigger className={`h-8 bg-black/40 text-tiny uppercase font-bold ${isActive(index, 'actionType') ? 'border-primary' : 'border-primary/20'}`}>
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
                            <label className="text-micro font-bold text-primary uppercase">Opération vanne</label>
                            <Select
                              value={step.action?.operation || ''}
                              onValueChange={(val) => updateStep(index, { action: { ...(step.action || {}), operation: val as any } })}
                            >
                              <SelectTrigger className={`h-8 bg-black/40 text-tiny uppercase font-bold ${isActive(index, 'actionTarget') ? 'border-primary' : 'border-primary/40'}`}>
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
                            <label className="text-micro font-bold text-primary uppercase">Vitesse</label>
                            <Select
                              value={step.action?.speed || ''}
                              onValueChange={(val) => updateStep(index, { action: { ...(step.action || {}), speed: val as any } })}
                            >
                              <SelectTrigger className={`h-8 bg-black/40 text-tiny uppercase font-bold ${isActive(index, 'actionTarget') ? 'border-primary' : 'border-primary/40'}`}>
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
                        <label className="text-micro font-bold text-muted-foreground uppercase">Durée (s)</label>
                        <Input
                          type="number"
                          value={step.duration?.value ?? ''}
                          onChange={(e) => updateStep(index, { duration: { ...(step.duration || {}), value: parseInt(e.target.value) || 0, display: `${e.target.value}s` } })}
                          onFocus={() => onFieldFocus?.(index, 'duration')}
                          className={`h-8 bg-black/40 text-center font-code text-xs ${isActive(index, 'duration') ? 'border-primary text-primary' : !step.duration?.value ? 'border-amber-500/50 text-amber-500' : 'border-border'}`}
                          placeholder="— non défini —"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-micro font-bold text-muted-foreground uppercase">Libellé du Bouton (UI)</label>
                        <Input
                          value={step.action?.ui?.label || ''}
                          onChange={(e) => updateStep(index, { action: { ...(step.action || {}), ui: { ...(step.action?.ui || {}), label: e.target.value } } })}
                          onFocus={() => onFieldFocus?.(index, 'actionLabel')}
                          className={`h-8 bg-black/40 text-tiny uppercase font-bold ${isActive(index, 'actionLabel') ? 'border-primary' : !step.action?.ui?.label ? 'border-amber-500/50 text-amber-500' : 'border-border'}`}
                          placeholder="— non défini —"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4 flex-wrap">
                      {/* Type de validation : affiché seulement si une valeur est active (step ou defaults) */}
                      {(() => {
                        const validationTypeValue =
                          step.validation?.conditions?.[0]?.type || '';
                        if (!validationTypeValue) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <label className="text-micro font-bold text-muted-foreground uppercase">Type de validation</label>
                            <Select
                              value={validationTypeValue}
                              onValueChange={(val) => {
                                if (!val) {
                                  // Aucun sélectionné manuellement → vider les conditions
                                  updateStep(index, { validation: { ...(step.validation || {}), conditions: [] } });
                                  return;
                                }
                                const conditions = [...(step.validation?.conditions || [])];
                                if (conditions.length === 0) {
                                  conditions.push({ id: `val-${Date.now()}`, type: val, operator: '==', value: 0, description: '', displayName: '' });
                                } else {
                                  conditions[0] = { ...conditions[0], type: val };
                                }
                                updateStep(index, { validation: { ...(step.validation || {}), conditions } });
                              }}
                            >
                              <SelectTrigger className="h-7 bg-black/40 text-tiny uppercase font-bold border-border">
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
                        );
                      })()}
                       {/* Timeout action : affiché seulement si une valeur est active */}
                       {(() => {
                         const timeoutActionValue =
                           step.validation?.timeout?.action || '';
                         if (!timeoutActionValue) return null;
                         return (
                           <div className="flex items-center gap-2">
                             <label className="text-micro font-bold text-muted-foreground uppercase">Timeout action</label>
                             <Select
                               value={timeoutActionValue}
                               onValueChange={(val) => {
                                 if (!val) return;
                                 updateStep(index, { validation: { ...(step.validation || {}), timeout: { ...(step.validation?.timeout || { value: 120, unit: 'seconds' }), action: val as any } } });
                               }}
                             >
                               <SelectTrigger className="h-7 bg-black/40 text-tiny uppercase font-bold border-border">
                                 <SelectValue placeholder="Action" />
                               </SelectTrigger>
                               <SelectContent className="bg-background border-border">
                                 <SelectItem value="">Aucun</SelectItem>
                                 {TIMEOUT_ACTIONS.map((action) => (
                                   <SelectItem key={action} value={action}>{action}</SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </div>
                         );
                       })()}
                       {/* Expression de succès : affichée seulement si une valeur est active */}
                       {(() => {
                         const successExprValue =
                           step.validation?.successExpression || '';
                         if (!successExprValue) return null;
                         return (
                           <div className="flex items-center gap-2">
                             <label className="text-micro font-bold text-muted-foreground uppercase">Expression succès</label>
                             <Input
                               value={successExprValue}
                               onChange={(e) => updateStep(index, { validation: { ...(step.validation || {}), successExpression: e.target.value } })}
                               onFocus={() => onFieldFocus?.(index, 'actionLabel')}
                               className={`h-7 bg-black/40 text-tiny font-code border-border ${isActive(index, 'actionLabel') ? 'border-primary text-primary' : 'text-foreground'}`}
                             />
                           </div>
                         );
                       })()}
                       <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-sm">
                         <Activity className="w-3.5 h-3.5 text-secondary" />
                         <span className="text-tiny font-bold text-secondary uppercase">
                           Validation : {(step.action?.type === 'valve_operation' || (step.validation?.conditions?.[0]?.type && step.validation?.conditions?.[0]?.type !== 'manual')) ? 'Automatique' : 'Manuelle'}
                         </span>
                       </div>
                      {/* Type alarme : affiché seulement si une valeur est active (step ou defaults) */}
                      {(() => {
                        const alarmTypeValue =
                          step.alarms?.[0]?.type || '';
                        if (!alarmTypeValue) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <label className="text-micro font-bold text-muted-foreground uppercase">Type alarme</label>
                            <Select
                              value={alarmTypeValue}
                              onValueChange={(val) => {
                                if (!val) {
                                  updateStep(index, { alarms: [] });
                                  return;
                                }
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
                              <SelectTrigger className="h-7 bg-black/40 text-tiny uppercase font-bold border-border">
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
                        );
                      })()}
                      {/* Sévérité alarme : affichée seulement si une alarme est active */}
                      {(() => {
                        const severityValue =
                          step.alarms?.[0]?.severity || '';
                        if (!severityValue) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <label className="text-micro font-bold text-muted-foreground uppercase">Sévérité alarme</label>
                            <Select
                              value={severityValue}
                              onValueChange={(val) => {
                                if (!val) return;
                                const alarms = [...(step.alarms || [])];
                                if (alarms.length === 0) {
                                  alarms.push({
                                    id: `alarm-${Date.now()}`,
                                    code: `ALM-${Date.now()}`,
                                    type: (defaults?.defaultAlarmType as any) || 'warning',
                                    severity: val as any,
                                    description: '',
                                    condition: '',
                                    remedy: { title: '', description: '', steps: [], estimatedTime: 0 },
                                    escalation: { ifPersistsAfter: 1, contact: '', message: '' },
                                  });
                                } else {
                                  alarms[0] = { ...alarms[0], severity: val as any };
                                }
                                updateStep(index, { alarms });
                              }}
                            >
                              <SelectTrigger className="h-7 bg-black/40 text-tiny uppercase font-bold border-border">
                                <SelectValue placeholder="Sévérité" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border-border">
                                <SelectItem value="">Aucun</SelectItem>
                                {ALARM_SEVERITIES.map((sev) => (
                                  <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* CUSTOM FIELDS SECTION */}
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        Attributs Personnalisés
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-tiny uppercase font-bold"
                        onClick={async () => {
                          try {
                            // Utilise apiClient pour supporter web ET Desktop Tauri
                            const res = await apiClient.get<{ success: boolean; items: any[] }>('/api/procedure-config-fields');
                            const templates: any[] = res.items ?? [];
                            const currentFields = step.fields || [];
                            const newFields = [...currentFields];

                            if (templates.length === 0) {
                              console.warn('[StepEditor] Aucun template de configuration trouvé.');
                            }

                            templates.forEach((t: any) => {
                              if (!currentFields.find((f) => f.templateId === t.id)) {
                                newFields.push({
                                  templateId: t.id,
                                  name: t.name,
                                  type: t.type,
                                  value: t.type === 'boolean' ? false : '',
                                  required: t.required,
                                });
                              }
                            });

                            updateStep(index, { fields: newFields });
                          } catch (err) {
                            console.error('[StepEditor] Failed to sync fields:', err);
                          }
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Synchroniser Config
                      </Button>
                    </div>
                    {step.fields && step.fields.length > 0 ? (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {step.fields.map((field, fIdx) => (
                          <div key={fIdx} className="space-y-1.5">
                            <label className="text-micro font-bold text-muted-foreground uppercase">
                              {field.name} {field.required && '*'}
                            </label>
                            {field.type === 'boolean' ? (
                              <div className="flex items-center h-8">
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={(e) => {
                                    const nextFields = [...step.fields!];
                                    nextFields[fIdx].value = e.target.checked;
                                    updateStep(index, { fields: nextFields });
                                  }}
                                  className="rounded border-border"
                                />
                              </div>
                            ) : (
                              <Input
                                type={field.type === 'number' ? 'number' : 'text'}
                                value={field.value || ''}
                                onChange={(e) => {
                                  const nextFields = [...step.fields!];
                                  nextFields[fIdx].value = field.type === 'number' ? Number(e.target.value) : e.target.value;
                                  updateStep(index, { fields: nextFields });
                                }}
                                className="h-8 bg-black/40 text-[10px] border-border"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground italic py-2">
                        Aucun attribut configuré pour cette étape. Cliquez sur synchroniser pour importer la configuration globale.
                      </div>
                    )}
                  </div>

                  {/* MEDIA REFERENCE SECTION */}
                  {defaults?.enableMedia && (
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" />
                      <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest">Médias de la séquence (réutilisation)</h4>
                    </div>
                    {mediaLibrary.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic py-1">
                        Aucun média dans la bibliothèque. Ajoutez-en un ci-dessus (capture / upload).
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {mediaLibrary.map((m) => {
                          const checked = (step.mediaRefs || []).includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                const current = step.mediaRefs || [];
                                const next = checked
                                  ? current.filter((id) => id !== m.id)
                                  : [...current, m.id];
                                updateStep(index, { mediaRefs: next });
                              }}
                              className={`group relative rounded overflow-hidden border text-left transition ${checked ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
                            >
                              <div className="aspect-video bg-black flex items-center justify-center">
                                {m.kind === 'image' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                                ) : (
                                  <video src={m.url} className="w-full h-full object-cover" muted />
                                )}
                              </div>
                              <div className="p-1.5 flex items-center gap-1.5 bg-card/60">
                                <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-micro font-code uppercase truncate">{m.title}</span>
                              </div>
                              {checked && (
                                <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(step.mediaRefs || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(step.mediaRefs || []).map((id) => {
                          const m = mediaLibrary.find((x) => x.id === id);
                          if (!m) return null;
                          return (
                            <Badge key={id} variant="outline" className="text-tiny font-code border-primary/40 text-primary">
                              {m.kind === 'image' ? 'Image' : 'Vidéo'} · {m.title}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}
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
