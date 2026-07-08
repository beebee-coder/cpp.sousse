"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetadataEditor } from './MetadataEditor';
import { StepEditor } from './StepEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Eye, Settings2, Layers, Mic, MicOff, Activity } from 'lucide-react';
import { FullProcedure, ProcedureStep } from '@/lib/procedures/types';
import { useVoice } from '@/hooks/use-voice';
import { useToast } from '@/hooks/use-toast';
import {
  PROCEDURE_CATEGORIES,
  PROCEDURE_SUBCATEGORIES,
  PROCEDURE_DEPARTMENTS,
  PROCEDURE_CRITICALITIES,
  PROCEDURE_LANGUAGES,
  ACTION_TYPES,
  VALIDATION_TYPES,
  ALARM_TYPES,
  ALARM_SEVERITIES,
  TIMEOUT_ACTIONS,
  VALVE_OPERATIONS,
  SPEED_MODES,
  DEFAULT_PROCEDURE_DEFAULTS,
  ProcedureDefaults,
} from '@/lib/procedures/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ForgeField = 'title' | 'code' | 'version' | 'description' | 'category' | 'criticality';
type StepField = 'title' | 'description' | 'subtitle' | 'duration' | 'actionType' | 'actionTarget' | 'actionLabel';

interface DynamicProcedureFormProps {
  onSubmit: (data: any) => void;
  isSaving?: boolean;
}

export function DynamicProcedureForm({ onSubmit, isSaving }: DynamicProcedureFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('metadata');
  const [activeField, setActiveField] = useState<ForgeField>('title');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeStepField, setActiveStepField] = useState<StepField>('title');
  const [lastTranscript, setLastTranscript] = useState('');
  const [defaults, setDefaults] = useState<ProcedureDefaults>(DEFAULT_PROCEDURE_DEFAULTS);
  const [procedure, setProcedure] = useState<Partial<FullProcedure>>({
    metadata: {
      title: '',
      code: '',
      category: 'OPERATION',
      department: 'PRODUCTION',
      criticality: 'MEDIUM',
      version: '1.0.0',
      author: { id: 'admin', name: 'Admin', role: 'admin', department: 'IT' },
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      tags: [],
      language: 'fr-FR'
    },
    prerequisites: {
      description: '',
      items: []
    },
    steps: []
  });

  const updateMetadata = (meta: any) => {
    setProcedure(prev => ({ ...prev, metadata: { ...prev.metadata, ...meta } as any }));
  };

  const updateSteps = (steps: ProcedureStep[]) => {
    setProcedure(prev => ({ ...prev, steps }));
  };

  const updateDefaults = (patch: Partial<ProcedureDefaults>) => {
    setDefaults(prev => ({ ...prev, ...patch }));
  };

  const createStepFromDefaults = (): ProcedureStep => {
    const actionType = defaults.defaultActionType || undefined;
    const timeoutAction = defaults.defaultTimeoutAction || undefined;
    const alarmType = defaults.defaultAlarmType || undefined;
    const alarmSeverity = defaults.defaultAlarmSeverity || undefined;
    const valveOperation = defaults.defaultValveOperation || undefined;
    const speedMode = defaults.defaultSpeedMode || undefined;
    const defaultDuration = defaults.defaultDuration || 60;
    const defaultUiLabel = defaults.defaultUiLabel || 'Confirmer';
    const defaultSuccessExpression = defaults.defaultSuccessExpression || 'status == OK';

    const action: any = {
      instruction: '',
      parameters: {},
      ui: {
        component: 'action_button',
        label: defaultUiLabel,
        icon: 'check',
      },
    };

    if (actionType) {
      action.type = actionType;
    }

    if (actionType === 'valve_operation') {
      action.valveId = '';
      action.operation = valveOperation || 'open';
      action.speed = speedMode;
      action.ui.component = 'valve_control';
      action.ui.icon = 'valve_open';
    }

    if (actionType === 'command') {
      action.command = '';
    }

    const alarms = alarmType
      ? [
          {
            id: `alarm-${Date.now()}`,
            code: `ALM-${Date.now()}`,
            type: alarmType as any,
            severity: alarmSeverity || 'medium',
            description: '',
            condition: '',
            remedy: { title: '', description: '', steps: [], estimatedTime: 0 },
            escalation: { ifPersistsAfter: 1, contact: '', message: '' },
          },
        ]
      : [];

    return {
      id: `step-${Date.now()}`,
      order: (procedure.steps?.length || 0) + 1,
      title: '',
      subtitle: '',
      description: '',
      duration: {
        value: defaultDuration,
        unit: 'seconds',
        display: `${defaultDuration}s`,
        type: 'fixed',
      },
      action,
      validation: {
        conditions: [],
        successExpression: defaultSuccessExpression,
        timeout: {
          value: 120,
          unit: 'seconds',
          ...(timeoutAction ? { action: timeoutAction } : {}),
        },
      },
      alarms,
      fallbacks: [],
      media: {},
      notes: [],
      dependencies: {
        prerequisites: [],
        dependsOn: [],
        requiresConfirmation: true,
      },
    } as ProcedureStep;
  };

  const synchronizeStepWithDefaults = useCallback((index: number) => {
    console.log('[SYNC_STEP] start', { index, defaults, stepCount: procedure.steps?.length });

    setProcedure(prev => {
      const steps = prev.steps || [];
      const step = steps[index];
      if (!step || !defaults) return prev;

      const actionType = defaults.defaultActionType || undefined;
      const timeoutAction = defaults.defaultTimeoutAction || undefined;
      const alarmType = defaults.defaultAlarmType || undefined;
      const alarmSeverity = defaults.defaultAlarmSeverity || undefined;
      const valveOperation = defaults.defaultValveOperation || undefined;
      const speedMode = defaults.defaultSpeedMode || undefined;
      const validationType = defaults.defaultValidationType || undefined;
      const defaultDuration = defaults.defaultDuration || step.duration?.value || 60;
      const defaultUiLabel = defaults.defaultUiLabel || step.action?.ui?.label || 'Confirmer';
      const defaultSuccessExpression = defaults.defaultSuccessExpression || step.validation?.successExpression || 'status == OK';

      const action: any = {
        ...(step.action || {}),
        instruction: step.action?.instruction || '',
        parameters: step.action?.parameters || {},
        ui: {
          ...(step.action?.ui || {}),
          component: 'action_button',
          label: defaultUiLabel,
          icon: 'check',
        },
      };

      if (actionType) {
        action.type = actionType;
      }

      if (actionType === 'valve_operation') {
        action.valveId = step.action?.valveId || '';
        action.operation = valveOperation || 'open';
        action.speed = speedMode;
        action.ui.component = 'valve_control';
        action.ui.icon = 'valve_open';
      }

      if (actionType === 'command') {
        action.command = step.action?.command || '';
      }

      const existingConditions = step.validation?.conditions || [];
      const conditions = validationType
        ? existingConditions.length > 0
          ? existingConditions.map(c => (c.type === validationType ? c : { ...c, type: validationType }))
          : [{ id: `val-${Date.now()}`, type: validationType, operator: '==', value: 0, description: '', displayName: '' }]
        : existingConditions;

      const alarms = alarmType
        ? [
            {
              id: step.alarms?.[0]?.id || `alarm-${Date.now()}`,
              code: step.alarms?.[0]?.code || `ALM-${Date.now()}`,
              type: alarmType as 'warning' | 'critical' | 'info',
              severity: (alarmSeverity || 'medium') as 'low' | 'medium' | 'high' | 'critical',
              description: step.alarms?.[0]?.description || '',
              condition: step.alarms?.[0]?.condition || '',
              remedy: step.alarms?.[0]?.remedy || { title: '', description: '', steps: [], estimatedTime: 0 },
              escalation: step.alarms?.[0]?.escalation || { ifPersistsAfter: 1, contact: '', message: '' },
            },
          ]
        : [];

      const updatedStep = {
        ...step,
        order: index + 1,
        duration: {
          ...(step.duration || {}),
          value: defaultDuration,
          unit: 'seconds',
          display: `${defaultDuration}s`,
          type: 'fixed' as const,
        },
        action,
        validation: {
          ...(step.validation || {}),
          conditions,
          successExpression: defaultSuccessExpression,
          timeout: {
            ...(step.validation?.timeout || {}),
            value: 120,
            unit: 'seconds',
            ...(timeoutAction ? { action: timeoutAction as 'abort' | 'warn' | 'retry' } : {}),
          },
        },
        alarms,
        dependencies: {
          ...(step.dependencies || {}),
          prerequisites: step.dependencies?.prerequisites || [],
          dependsOn: step.dependencies?.dependsOn || [],
          requiresConfirmation: step.dependencies?.requiresConfirmation ?? true,
        },
      };

      const updatedSteps = [...steps];
      updatedSteps[index] = updatedStep;

      console.log('[SYNC_STEP] success', {
        index,
        actionType,
        validationType,
        alarmType,
        alarmCount: alarms.length,
        timeoutAction,
        valveOperation,
        speedMode,
        defaultDuration,
        defaultUiLabel,
        stepId: updatedStep.id,
      });

      return { ...prev, steps: updatedSteps };
    });

    toast({
      title: 'Étape synchronisée',
      description: `Étape ${index + 1} mise à jour avec la configuration courante.`,
    });
  }, [defaults, updateSteps, toast]);

  const parseVoiceCommand = useCallback((raw: string, currentField: ForgeField, currentStepField: StepField) => {
    const t = raw.trim();
    const lower = t.toLowerCase();

    if (activeTab === 'steps') {
      const stepMatch = t.match(/^(?:.tape|.tapes|.tape)\s+(\d+)\s+(.*)$/i);
      if (stepMatch && stepMatch[1] && stepMatch[2]) {
        const stepIndex = parseInt(stepMatch[1]) - 1;
        const remainder = stepMatch[2].trim();
        
        const fieldPatterns: { field: StepField; patterns: RegExp[] }[] = [
          { field: 'title', patterns: [/^(?:titre|nom|action)[\s:]+(.+)$/i] },
          { field: 'description', patterns: [/^(?:description|instruction|d.tail)[\s:]+(.+)$/i] },
          { field: 'subtitle', patterns: [/^(?:sous.titre|phase|sous titre)[\s:]+(.+)$/i] },
          { field: 'duration', patterns: [/^(?:dur.e|temps|durée|duration)[\s:]+(\d+)$/i] },
          { field: 'actionType', patterns: [/^(?:type|action)[\s:]+(.+)$/i] },
          { field: 'actionTarget', patterns: [/^(?:cible|target|pourcentage)[\s:]+(\d+)$/i] },
          { field: 'actionLabel', patterns: [/^(?:bouton|label|libell.)[\s:]+(.+)$/i] },
        ];

        for (const { field, patterns } of fieldPatterns) {
          for (const regex of patterns) {
            const match = remainder.match(regex);
            if (match && match[1]) {
              return { stepIndex, stepField: field, text: match[1].trim(), isStep: true as const };
            }
          }
        }

        return { stepIndex, stepField: currentStepField, text: remainder, isStep: true as const };
      }
    }

    const fieldPatterns: { field: ForgeField; patterns: RegExp[] }[] = [
      { field: 'title', patterns: [/^(?:titre|nom)[\s:]+(.+)$/i] },
      { field: 'code', patterns: [/^(?:code|r.f.rence)[\s:]+(.+)$/i] },
      { field: 'version', patterns: [/^(?:version|v)[\s:]+(.+)$/i] },
      { field: 'description', patterns: [/^(?:description|contexte)[\s:]+(.+)$/i] },
      { field: 'category', patterns: [/^(?:cat.gorie)[\s:]+(.+)$/i] },
      { field: 'criticality', patterns: [/^(?:criticit.)[\s:]+(.+)$/i] },
    ];

    for (const { field, patterns } of fieldPatterns) {
      for (const regex of patterns) {
        const match = t.match(regex);
        if (match && match[1]) {
          return { field, text: match[1].trim() };
        }
      }
    }

    if (/^(?:ajouter.tape|add step|nouvelle .tape|ajoute).*$/i.test(lower)) {
      return { action: 'addStep' as const };
    }
    if (/^(?:supprimer.tape|delete step|remove step).*$/i.test(lower)) {
      return { action: 'removeStep' as const };
    }
    if (/^(?:envoyer|envoye|send|sauvegarder|enregistrer).*$/i.test(lower)) {
      return { action: 'send' as const };
    }
    if (/^(?:annuler|effacer|supprimer|vider|non|annule)[\s.!?]*$/i.test(lower)) {
      return { action: 'clear' as const };
    }

    return { field: currentField, text: lower };
  }, [activeTab]);

  const applyToMetadataField = useCallback((field: ForgeField, text: string) => {
    if (field === 'title') updateMetadata({ title: text });
    else if (field === 'code') updateMetadata({ code: text });
    else if (field === 'version') updateMetadata({ version: text });
    else if (field === 'description') updateMetadata({ description: text });
    else if (field === 'category') updateMetadata({ category: text.toUpperCase() });
    else if (field === 'criticality') updateMetadata({ criticality: text.toUpperCase() });
  }, []);

  const applyToStepField = useCallback((stepIndex: number, field: StepField, text: string) => {
    if (!procedure.steps) return;
    const steps = [...procedure.steps];
    if (stepIndex >= steps.length) return;
    const step = { ...steps[stepIndex] };

    if (field === 'title') step.title = text;
    else if (field === 'description') step.description = text;
    else if (field === 'subtitle') step.subtitle = text;
    else if (field === 'duration') {
      const val = parseInt(text) || 0;
      step.duration = { ...step.duration, value: val, display: `${val}s` };
    }
    else if (field === 'actionType') step.action = { ...step.action, type: text.toLowerCase() as any };
    else if (field === 'actionTarget') step.action = { ...step.action, target: parseInt(text) || 0 };
    else if (field === 'actionLabel') step.action = { ...step.action, ui: { ...step.action.ui, label: text } };

    steps[stepIndex] = step;
    setProcedure(prev => ({ ...prev, steps }));
  }, [procedure.steps]);

  const clearMetadataField = useCallback((field: ForgeField) => {
    if (field === 'title') updateMetadata({ title: '' });
    else if (field === 'code') updateMetadata({ code: '' });
    else if (field === 'version') updateMetadata({ version: '' });
    else if (field === 'description') updateMetadata({ description: '' });
    else if (field === 'category') updateMetadata({ category: 'OPERATION' });
    else if (field === 'criticality') updateMetadata({ criticality: 'MEDIUM' });
  }, []);

  const voice = useVoice({
    onResult: (text) => {
      setLastTranscript(text);
      const parsed = parseVoiceCommand(text, activeField, activeStepField);

      if (parsed.action === 'addStep') {
        (document.querySelector('[data-add-step]') as HTMLButtonElement)?.click();
        toast({ title: 'Étape ajoutée', description: 'Nouvelle séquence ajoutée.' });
        return;
      }
      if (parsed.action === 'removeStep') {
        const steps = procedure.steps || [];
        if (steps.length > 0) {
          updateSteps(steps.slice(0, -1));
          toast({ title: 'Étape supprimée', description: 'Dernière séquence supprimée.' });
        }
        return;
      }
      if (parsed.action === 'send') {
        onSubmit(procedure);
        return;
      }
      if (parsed.action === 'clear') {
        if (activeTab === 'metadata') {
          clearMetadataField(activeField);
          toast({ title: 'Correction vocale', description: 'Champ effacé.' });
        } else {
          applyToStepField(activeStepIndex, activeStepField, '');
          toast({ title: 'Correction vocale', description: 'Dernière reconnaissance supprimée.' });
        }
        return;
      }

      if (parsed.isStep) {
        setActiveStepIndex(parsed.stepIndex);
        setActiveStepField(parsed.stepField);
        applyToStepField(parsed.stepIndex, parsed.stepField, parsed.text);
      } else {
        setActiveField(parsed.field);
        applyToMetadataField(parsed.field, parsed.text);
      }
    },
    onCorrection: () => {
      if (activeTab === 'metadata') {
        clearMetadataField(activeField);
      } else {
        applyToStepField(activeStepIndex, activeStepField, '');
      }
      toast({ title: 'Correction vocale', description: 'Dernière reconnaissance supprimée.' });
    },
    autoRestart: false,
    lang: 'fr-FR'
  });

  const getActiveVoice = () => voice;

  if (!procedure.steps) {
    setProcedure(prev => ({ ...prev, steps: [] }));
  }

  return (
    <div className="space-y-6 pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TabsList className="bg-muted/30 border border-border p-1">
              <TabsTrigger value="config" className="text-[10px] uppercase font-bold px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings2 className="w-3.5 h-3.5 mr-2" /> Configuration
              </TabsTrigger>
              <TabsTrigger value="steps" className="text-[10px] uppercase font-bold px-6 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                <Layers className="w-3.5 h-3.5 mr-2" /> Séquençage
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-[10px] uppercase font-bold px-6 data-[state=active]:bg-white data-[state=active]:text-black">
                <Eye className="w-3.5 h-3.5 mr-2" /> Aperçu
              </TabsTrigger>
            </TabsList>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted/10 border border-border rounded-sm">
              <p className="text-[9px] font-code text-muted-foreground uppercase">
                Champ : <span className="text-primary font-bold">{activeTab === 'metadata' ? activeField : `Étape ${activeStepIndex + 1} / ${activeStepField}`}</span>
              </p>
              {lastTranscript && (
                <p className="text-[8px] font-code text-muted-foreground/70 max-w-xs truncate">
                  "{lastTranscript}"
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant={voice.isListening ? "destructive" : "secondary"}
                onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
                disabled={!voice.isSupported}
                className="h-7 gap-1.5 text-[9px] uppercase font-bold"
              >
                {voice.isListening ? (
                  <><MicOff className="w-3 h-3" /> Stop</>
                ) : (
                  <><Mic className="w-3 h-3" /> Parler</>
                )}
              </Button>
            </div>
          </div>

          <Button 
            onClick={() => onSubmit(procedure)} 
            disabled={isSaving}
            className="bg-primary text-primary-foreground font-bold uppercase text-[11px] h-10 px-8 shadow-[0_0_20px_rgba(50,181,212,0.2)]"
          >
            {isSaving ? "Synchronisation..." : "Enregistrer la Procédure"}
            <Save className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <TabsContent value="config" className="mt-0 focus-visible:ring-0">
          <Card className="p-6 border-border bg-card/40 space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                  <Settings2 className="w-4 h-4 text-primary" />
                  <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Identification</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Catégorie</label>
                    <Select value={defaults.category} onValueChange={(val) => updateDefaults({ category: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {PROCEDURE_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Sous-catégorie</label>
                    <Select value={defaults.subcategory} onValueChange={(val) => updateDefaults({ subcategory: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {PROCEDURE_SUBCATEGORIES.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Département</label>
                      <Select value={defaults.department} onValueChange={(val) => updateDefaults({ department: val })}>
                        <SelectTrigger className="bg-black/40 border h-10">
                          <SelectValue placeholder="SÉLECTION" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="">Aucun</SelectItem>
                          {PROCEDURE_DEPARTMENTS.map(dep => (
                            <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Criticité</label>
                      <Select value={defaults.criticality} onValueChange={(val) => updateDefaults({ criticality: val })}>
                        <SelectTrigger className="bg-black/40 border h-10">
                          <SelectValue placeholder="SÉLECTION" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="">Aucun</SelectItem>
                          {PROCEDURE_CRITICALITIES.map(crit => (
                            <SelectItem key={crit} value={crit}>{crit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Langue</label>
                    <Select value={defaults.language} onValueChange={(val) => updateDefaults({ language: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {PROCEDURE_LANGUAGES.map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-secondary/20">
                  <Layers className="w-4 h-4 text-secondary" />
                  <h3 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">Comportement par défaut des étapes</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Type d'action</label>
                    <Select value={defaults.defaultActionType} onValueChange={(val) => updateDefaults({ defaultActionType: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {ACTION_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Opération vanne</label>
                    <Select value={defaults.defaultValveOperation} onValueChange={(val) => updateDefaults({ defaultValveOperation: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {VALVE_OPERATIONS.map(op => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Type de validation</label>
                    <Select value={defaults.defaultValidationType} onValueChange={(val) => updateDefaults({ defaultValidationType: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {VALIDATION_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Action timeout</label>
                    <Select value={defaults.defaultTimeoutAction} onValueChange={(val) => updateDefaults({ defaultTimeoutAction: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {TIMEOUT_ACTIONS.map(action => (
                          <SelectItem key={action} value={action}>{action}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Type d'alarme</label>
                    <Select value={defaults.defaultAlarmType} onValueChange={(val) => updateDefaults({ defaultAlarmType: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {ALARM_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Sévérité d'alarme</label>
                    <Select value={defaults.defaultAlarmSeverity} onValueChange={(val) => updateDefaults({ defaultAlarmSeverity: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {ALARM_SEVERITIES.map(sev => (
                          <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Vitesse</label>
                    <Select value={defaults.defaultSpeedMode} onValueChange={(val) => updateDefaults({ defaultSpeedMode: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="">Aucun</SelectItem>
                        {SPEED_MODES.map(mode => (
                          <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Durée par défaut (s)</label>
                    <Input
                      type="number"
                      value={defaults.defaultDuration}
                      onChange={(e) => updateDefaults({ defaultDuration: parseInt(e.target.value) || 0 })}
                      className="h-10 bg-black/40 border font-code text-xs"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Label bouton</label>
                    <Input
                      value={defaults.defaultUiLabel}
                      onChange={(e) => updateDefaults({ defaultUiLabel: e.target.value })}
                      className="h-10 bg-black/40 border font-code text-xs uppercase"
                      placeholder="CONFIRMER"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Expression de succès</label>
                    <Input
                      value={defaults.defaultSuccessExpression}
                      onChange={(e) => updateDefaults({ defaultSuccessExpression: e.target.value })}
                      className="h-10 bg-black/40 border font-code text-xs"
                      placeholder="status == OK"
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/10 border border-border/40 rounded-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">Aperçu de la configuration par défaut</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {defaults.defaultActionType ? (
                      <Badge variant="outline" className="text-[9px] font-code border-primary/40 text-primary">
                        Action: {defaults.defaultActionType}
                      </Badge>
                    ) : null}
                    {defaults.defaultValveOperation ? (
                      <Badge variant="outline" className="text-[9px] font-code border-primary/40 text-primary">
                        Vanne: {defaults.defaultValveOperation}
                      </Badge>
                    ) : null}
                    {defaults.defaultAlarmType ? (
                      <Badge variant="outline" className="text-[9px] font-code border-destructive/40 text-destructive">
                        Alarme: {defaults.defaultAlarmType}
                      </Badge>
                    ) : null}
                    {defaults.defaultDuration ? (
                      <Badge variant="outline" className="text-[9px] font-code border-secondary/40 text-secondary">
                        Durée: {defaults.defaultDuration}s
                      </Badge>
                    ) : null}
                    {defaults.defaultUiLabel ? (
                      <Badge variant="outline" className="text-[9px] font-code border-secondary/40 text-secondary">
                        Bouton: {defaults.defaultUiLabel}
                      </Badge>
                    ) : null}
                    {defaults.defaultSuccessExpression ? (
                      <Badge variant="outline" className="text-[9px] font-code border-secondary/40 text-secondary">
                        Expression: {defaults.defaultSuccessExpression}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="steps" className="mt-0 focus-visible:ring-0">
          <StepEditor
            key={`step-editor-${defaults.defaultActionType}-${defaults.defaultDuration}`}
            steps={procedure.steps || []}
            onChange={updateSteps}
            defaults={defaults}
            createStep={createStepFromDefaults}
            onSyncStepWithDefaults={synchronizeStepWithDefaults}
            activeStepIndex={activeStepIndex}
            activeStepField={activeStepField}
            onFieldFocus={(stepIdx, field) => {
              setActiveStepIndex(stepIdx);
              setActiveStepField(field);
              setActiveTab('steps');
            }}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-0 focus-visible:ring-0">
          <Card className="p-8 border-border bg-black/40 min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-4 opacity-50">
              <Eye className="w-12 h-12 mx-auto text-primary" />
              <p className="font-code text-[11px] uppercase tracking-widest">Moteur de rendu en attente de données réelles</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
