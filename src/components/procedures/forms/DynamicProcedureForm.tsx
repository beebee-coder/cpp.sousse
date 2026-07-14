"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MetadataEditor } from './MetadataEditor';
import { StepEditor } from './StepEditor';
import { ProcedureMedia } from '@/lib/procedures/types';
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
  const [activeTab, setActiveTab] = useState('config');
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
    steps: [],
    mediaLibrary: []
  });

  const updateMetadata = (meta: any) => {
    setProcedure(prev => ({ ...prev, metadata: { ...prev.metadata, ...meta } as any }));
  };

  const updateSteps = (steps: ProcedureStep[]) => {
    setProcedure(prev => ({ ...prev, steps }));
  };

  const updateMediaLibrary = (media: ProcedureMedia[]) => {
    setProcedure(prev => ({ ...prev, mediaLibrary: media }));
  };

  const updateDefaults = (patch: Partial<ProcedureDefaults>) => {
    setDefaults(prev => ({ ...prev, ...patch }));

    console.log('[CONFIG][DEFAULTS] patch reçu :', patch);

    // Propager les métadonnées de la configuration vers procedure.metadata
    const metadataFields = ['category', 'subcategory', 'department', 'criticality', 'language'];
    const metadataPatch: any = {};
    Object.keys(patch).forEach(key => {
      if (metadataFields.includes(key)) {
        metadataPatch[key] = (patch as any)[key];
      }
    });

    if (Object.keys(metadataPatch).length > 0) {
      setProcedure(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          ...metadataPatch,
        } as any
      }));
    }
  };

  const createStepFromDefaults = (): ProcedureStep => {
    console.log('[CONFIG][CREATE_STEP] defaults utilisés :', {
      defaultActionType: defaults.defaultActionType,
      defaultValidationType: defaults.defaultValidationType,
      defaultAlarmType: defaults.defaultAlarmType,
      defaultAlarmSeverity: defaults.defaultAlarmSeverity,
      defaultTimeoutAction: defaults.defaultTimeoutAction,
      defaultValveOperation: defaults.defaultValveOperation,
      defaultSpeedMode: defaults.defaultSpeedMode,
      defaultDuration: defaults.defaultDuration,
      defaultUiLabel: defaults.defaultUiLabel,
      defaultSuccessExpression: defaults.defaultSuccessExpression,
    });

    return {
      id: `step-${Date.now()}`,
      order: (procedure.steps?.length || 0) + 1,
      title: '',
      subtitle: '',
      description: '',
      duration: {
        value: 0,
        unit: 'seconds',
        display: '—',
        type: 'fixed',
      },
      action: {
        type: '' as any,
        instruction: '',
        parameters: {},
        ui: {
          component: 'action_button',
          label: '',
          icon: 'check',
        },
      },
      validation: {
        conditions: [],
        successExpression: '',
        timeout: {
          value: 120,
          unit: 'seconds',
          action: 'warn',
        },
      },
      alarms: [],
      fields: [],
      fallbacks: [],
      media: {},
      mediaRefs: [],
      notes: [],
      dependencies: {
        prerequisites: [],
        dependsOn: [],
        requiresConfirmation: true,
      },
    } as ProcedureStep;
  };

  const synchronizeStepWithDefaults = useCallback(async (index: number) => {
    // ─── 1. Lire les valeurs configurées MAINTENANT (synchrone, avant tout await)
    //        Règle : si la valeur est vide → on ne touche pas au champ de la séquence
    const cfgActionType    = defaults.defaultActionType    || '';
    const cfgValidationType = defaults.defaultValidationType || '';
    const cfgAlarmType     = defaults.defaultAlarmType     || '';
    const cfgAlarmSeverity = defaults.defaultAlarmSeverity || '';
    const cfgValveOperation = defaults.defaultValveOperation || '';
    const cfgSpeedMode     = defaults.defaultSpeedMode     || '';
    const cfgTimeoutAction = defaults.defaultTimeoutAction  || '';
    const cfgDuration      = defaults.defaultDuration;           // number | undefined
    const cfgUiLabel       = defaults.defaultUiLabel       || '';
    const cfgSuccessExpr   = defaults.defaultSuccessExpression || '';

    console.log('[SYNC] config capturé :', {
      cfgActionType, cfgValidationType, cfgAlarmType,
      cfgDuration, cfgUiLabel, cfgSuccessExpr,
    });

    // ─── 2. Fetch des champs personnalisés (ProcedureFieldTemplate)
    let configFieldTemplates: any[] = [];
    try {
      const res = await apiClient.get<{ success: boolean; items: any[] }>('/api/procedure-config-fields');
      configFieldTemplates = (res.items ?? []).filter((t: any) => !!t.name); // garder seulement ceux avec un nom
    } catch (e: any) {
      console.warn('[SYNC] Erreur templates :', e.message);
    }

    // ─── 3. Mise à jour de la séquence — "apply only if configured"
    setProcedure(prev => {
      const steps = prev.steps || [];
      const step  = steps[index];
      if (!step) return prev;

      // ── Type d'action (appliqué seulement si configuré)
      const action: any = { ...(step.action || {}) };
      const actionApplied: string[] = [];
      if (cfgActionType) {
        action.type = cfgActionType;
        action.ui = {
          ...(action.ui || {}),
          component: cfgActionType === 'valve_operation' ? 'valve_control' : 'action_button',
          icon:      cfgActionType === 'valve_operation' ? 'valve_open'    : 'check',
        };
        if (cfgActionType === 'valve_operation') {
          if (cfgValveOperation) action.operation = cfgValveOperation;
          if (cfgSpeedMode)      action.speed      = cfgSpeedMode;
          actionApplied.push(`type=${cfgActionType}`);
          if (cfgValveOperation) actionApplied.push(`operation=${cfgValveOperation}`);
          if (cfgSpeedMode)      actionApplied.push(`speed=${cfgSpeedMode}`);
        } else {
          delete action.operation;
          delete action.speed;
          delete action.valveId;
          actionApplied.push(`type=${cfgActionType}`);
        }
        if (cfgActionType !== 'command') delete action.command;
      } else {
        console.log('[SYNC][APPLY] action.type : ignoré (valeur vide)');
      }

      // ── Libellé du bouton (appliqué seulement si configuré)
      if (cfgUiLabel) {
        action.ui = { ...(action.ui || {}), label: cfgUiLabel };
        actionApplied.push(`uiLabel=${cfgUiLabel}`);
      } else {
        console.log('[SYNC][APPLY] action.ui.label : ignoré (valeur vide)');
      }

      // ── Durée (appliquée seulement si > 0 et configurée)
      let durationApplied = false;
      const duration = (cfgDuration !== undefined && cfgDuration > 0)
        ? (() => {
            durationApplied = true;
            return { ...(step.duration || {}), value: cfgDuration, unit: 'seconds', display: `${cfgDuration}s`, type: 'fixed' as const };
          })()
        : step.duration;
      if (!durationApplied) {
        console.log('[SYNC][APPLY] duration : ignoré (valeur vide ou 0)');
      }

      // ── Conditions de validation (appliquées seulement si type configuré)
      let conditions = step.validation?.conditions || [];
      if (cfgValidationType) {
        conditions = conditions.length > 0
          ? conditions.map(c => ({ ...c, type: cfgValidationType }))
          : [{ id: `val-${Date.now()}`, type: cfgValidationType, operator: '==', value: 0, description: '', displayName: '' }];
        console.log('[SYNC][APPLY] validation.type :', cfgValidationType);
      } else {
        console.log('[SYNC][APPLY] validation.type : ignoré (valeur vide)');
      }

      // ── Expression de succès (appliquée seulement si configurée)
      const successExpression = cfgSuccessExpr
        ? cfgSuccessExpr
        : step.validation?.successExpression || '';
      if (!cfgSuccessExpr) {
        console.log('[SYNC][APPLY] successExpression : ignoré (valeur vide)');
      }

      // ── Timeout action (appliquée seulement si configurée)
      const timeout = {
        ...(step.validation?.timeout || { value: 120, unit: 'seconds' }),
        ...(cfgTimeoutAction ? { action: cfgTimeoutAction as 'abort' | 'warn' | 'retry' } : {}),
      } as ProcedureStep['validation']['timeout'];
      if (!cfgTimeoutAction) {
        console.log('[SYNC][APPLY] timeout.action : ignoré (valeur vide)');
      }

      // ── Alarmes (appliquées seulement si type configuré)
      let alarms = step.alarms || [];
      if (cfgAlarmType) {
        alarms = [{
          id:          step.alarms?.[0]?.id   || `alarm-${Date.now()}`,
          code:        step.alarms?.[0]?.code  || `ALM-${Date.now()}`,
          type:        cfgAlarmType as 'warning' | 'critical' | 'info',
          severity:    (cfgAlarmSeverity || step.alarms?.[0]?.severity || 'medium') as 'low' | 'medium' | 'high' | 'critical',
          description: step.alarms?.[0]?.description || '',
          condition:   step.alarms?.[0]?.condition   || '',
          remedy:      step.alarms?.[0]?.remedy      || { title: '', description: '', steps: [], estimatedTime: 0 },
          escalation:  step.alarms?.[0]?.escalation  || { ifPersistsAfter: 1, contact: '', message: '' },
        }];
        console.log('[SYNC][APPLY] alarme :', { type: cfgAlarmType, severity: cfgAlarmSeverity || 'medium' });
      } else {
        console.log('[SYNC][APPLY] alarme : ignoré (valeur vide)');
      }

      // ── Champs personnalisés (ProcedureFieldTemplate) — ajout sans doublons
      const currentFields = step.fields || [];
      const mergedFields  = [...currentFields];
      configFieldTemplates.forEach((t: any) => {
        if (!mergedFields.find(f => f.templateId === t.id)) {
          mergedFields.push({
            templateId: t.id,
            name:       t.name,
            type:       t.type,
            value:      t.type === 'boolean' ? false : '',
            required:   t.required,
          });
        }
      });

      const updatedStep = {
        ...step,
        order:  index + 1,
        fields: mergedFields,
        duration,
        action,
        validation: {
          ...(step.validation || {}),
          conditions,
          successExpression,
          timeout,
        },
        alarms,
      };

      console.log('[SYNC] step mis à jour :', {
        index,
        actionType:     updatedStep.action?.type,
        duration:       updatedStep.duration?.value,
        uiLabel:        updatedStep.action?.ui?.label,
        validationType: updatedStep.validation?.conditions?.[0]?.type,
        alarmType:      updatedStep.alarms?.[0]?.type,
        appliedFields:  actionApplied,
      });

      const updatedSteps = [...steps];
      updatedSteps[index] = updatedStep;
      return { ...prev, steps: updatedSteps };
    });

    // ─── 4. Toast récapitulatif (uniquement les champs appliqués)
    const applied: string[] = [];
    if (cfgActionType)     applied.push(`Action: ${cfgActionType}`);
    if (cfgDuration && cfgDuration > 0) applied.push(`Durée: ${cfgDuration}s`);
    if (cfgUiLabel)        applied.push(`Bouton: ${cfgUiLabel}`);
    if (cfgValidationType) applied.push(`Validation: ${cfgValidationType}`);
    if (cfgAlarmType)      applied.push(`Alarme: ${cfgAlarmType}`);
    if (cfgTimeoutAction)  applied.push(`Timeout: ${cfgTimeoutAction}`);
    if (configFieldTemplates.length > 0) applied.push(`+${configFieldTemplates.length} champ(s) perso`);

    console.log('[SYNC] toast applied :', applied);

    toast({
      title: `Étape ${index + 1} synchronisée`,
      description: applied.length > 0
        ? applied.join(' · ')
        : 'Aucune valeur configurée à appliquer.',
    });
  }, [defaults, toast]);


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
        if (activeTab === 'config') {
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
      if (activeTab === 'config') {
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 min-w-0">
            <div className="overflow-x-auto terminal-scroll">
              <TabsList className="bg-muted/30 border border-border p-1 inline-flex w-max">
                <TabsTrigger value="config" className="text-[10px] uppercase font-bold px-3 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Settings2 className="w-3.5 h-3.5 mr-2" /> Configuration
                </TabsTrigger>
                <TabsTrigger value="steps" className="text-[10px] uppercase font-bold px-3 sm:px-6 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Séquençage
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-[10px] uppercase font-bold px-3 sm:px-6 data-[state=active]:bg-white data-[state=active]:text-black">
                  <Eye className="w-3.5 h-3.5 mr-2" /> Aperçu
                </TabsTrigger>
              </TabsList>
            </div>

              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted/10 border border-border rounded-sm">
                <p className="text-tiny font-code text-muted-foreground uppercase">
                  Champ : <span className="text-primary font-bold">{activeTab === 'config' ? activeField : `Étape ${activeStepIndex + 1} / ${activeStepField}`}</span>
                </p>
              {lastTranscript && (
                <p className="text-micro font-code text-muted-foreground/70 max-w-xs truncate">
                  "{lastTranscript}"
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant={voice.isListening ? "destructive" : "secondary"}
                onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
                disabled={!voice.isSupported}
                className="h-7 gap-1.5 text-tiny uppercase font-bold"
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
            className="w-full lg:w-auto bg-primary text-primary-foreground font-bold uppercase text-[11px] h-10 px-8 shadow-[0_0_20px_rgba(50,181,212,0.2)]"
          >
            {isSaving ? "Synchronisation..." : "Enregistrer la Procédure"}
            <Save className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <TabsContent value="config" className="mt-0 focus-visible:ring-0">
          <Card className="p-6 panel-card space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                  <Settings2 className="w-4 h-4 text-primary" />
                  <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Identification</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Catégorie</label>
                    <Select value={defaults.category} onValueChange={(val) => updateDefaults({ category: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {PROCEDURE_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Sous-catégorie</label>
                    <Select value={defaults.subcategory} onValueChange={(val) => updateDefaults({ subcategory: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {PROCEDURE_SUBCATEGORIES.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Département</label>
                      <Select value={defaults.department} onValueChange={(val) => updateDefaults({ department: val })}>
                        <SelectTrigger className="bg-black/40 border h-10">
                          <SelectValue placeholder="SÉLECTION" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="__none__">Aucun</SelectItem>
                          {PROCEDURE_DEPARTMENTS.map(dep => (
                            <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Criticité</label>
                      <Select value={defaults.criticality} onValueChange={(val) => updateDefaults({ criticality: val })}>
                        <SelectTrigger className="bg-black/40 border h-10">
                          <SelectValue placeholder="SÉLECTION" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          <SelectItem value="__none__">Aucun</SelectItem>
                          {PROCEDURE_CRITICALITIES.map(crit => (
                            <SelectItem key={crit} value={crit}>{crit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Langue</label>
                    <Select value={defaults.language} onValueChange={(val) => updateDefaults({ language: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
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
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Type d'action</label>
                    <Select value={defaults.defaultActionType} onValueChange={(val) => updateDefaults({ defaultActionType: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {ACTION_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Opération vanne</label>
                    <Select value={defaults.defaultValveOperation} onValueChange={(val) => updateDefaults({ defaultValveOperation: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {VALVE_OPERATIONS.map(op => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Type de validation</label>
                    <Select value={defaults.defaultValidationType} onValueChange={(val) => updateDefaults({ defaultValidationType: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {VALIDATION_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Action timeout</label>
                    <Select value={defaults.defaultTimeoutAction} onValueChange={(val) => updateDefaults({ defaultTimeoutAction: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {TIMEOUT_ACTIONS.map(action => (
                          <SelectItem key={action} value={action}>{action}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Type d'alarme</label>
                    <Select value={defaults.defaultAlarmType} onValueChange={(val) => updateDefaults({ defaultAlarmType: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {ALARM_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Sévérité d'alarme</label>
                    <Select value={defaults.defaultAlarmSeverity} onValueChange={(val) => updateDefaults({ defaultAlarmSeverity: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {ALARM_SEVERITIES.map(sev => (
                          <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Vitesse</label>
                    <Select value={defaults.defaultSpeedMode} onValueChange={(val) => updateDefaults({ defaultSpeedMode: val })}>
                      <SelectTrigger className="bg-black/40 border h-10">
                        <SelectValue placeholder="SÉLECTION" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {SPEED_MODES.map(mode => (
                          <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Durée par défaut (s)</label>
                    <Input
                      type="number"
                      value={defaults.defaultDuration}
                      onChange={(e) => updateDefaults({ defaultDuration: parseInt(e.target.value) || 0 })}
                      className="h-10 bg-black/40 border font-code text-xs"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Label bouton</label>
                    <Input
                      value={defaults.defaultUiLabel}
                      onChange={(e) => updateDefaults({ defaultUiLabel: e.target.value })}
                      className="h-10 bg-black/40 border font-code text-xs uppercase"
                      placeholder="CONFIRMER"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Expression de succès</label>
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
                    <span className="text-tiny font-bold text-secondary uppercase tracking-widest">Aperçu de la configuration par défaut</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {defaults.defaultActionType ? (
                      <Badge variant="outline" className="text-tiny font-code border-primary/40 text-primary">
                        Action: {defaults.defaultActionType}
                      </Badge>
                    ) : null}
                    {defaults.defaultValveOperation ? (
                      <Badge variant="outline" className="text-tiny font-code border-primary/40 text-primary">
                        Vanne: {defaults.defaultValveOperation}
                      </Badge>
                    ) : null}
                    {defaults.defaultAlarmType ? (
                      <Badge variant="outline" className="text-tiny font-code border-destructive/40 text-destructive">
                        Alarme: {defaults.defaultAlarmType}
                      </Badge>
                    ) : null}
                    {defaults.defaultDuration ? (
                      <Badge variant="outline" className="text-tiny font-code border-secondary/40 text-secondary">
                        Durée: {defaults.defaultDuration}s
                      </Badge>
                    ) : null}
                    {defaults.defaultUiLabel ? (
                      <Badge variant="outline" className="text-tiny font-code border-secondary/40 text-secondary">
                        Bouton: {defaults.defaultUiLabel}
                      </Badge>
                    ) : null}
                    {defaults.defaultSuccessExpression ? (
                      <Badge variant="outline" className="text-tiny font-code border-secondary/40 text-secondary">
                        Expression: {defaults.defaultSuccessExpression}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Médias dans la séquence (image / vidéo)</h3>
                  <p className="text-tiny text-muted-foreground/70 font-code mt-1">
                    Option : active la capture / upload de médias dans l'onglet Séquençage.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-tiny font-code border-border ${defaults.enableMedia ? 'text-primary border-primary/40' : 'text-muted-foreground'}`}>
                  {defaults.enableMedia ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                </Badge>
                <Switch
                  checked={defaults.enableMedia}
                  onCheckedChange={(val) => updateDefaults({ enableMedia: val })}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="steps" className="mt-0 focus-visible:ring-0">
          <StepEditor
            key={`step-editor-${defaults.defaultActionType}-${defaults.defaultDuration}`}
            steps={procedure.steps || []}
            mediaLibrary={procedure.mediaLibrary || []}
            onMediaLibraryChange={updateMediaLibrary}
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
