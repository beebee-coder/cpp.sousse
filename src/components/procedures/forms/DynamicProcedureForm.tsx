"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetadataEditor } from './MetadataEditor';
import { StepEditor } from './StepEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Eye, Settings2, Layers, Mic, MicOff } from 'lucide-react';
import { FullProcedure, ProcedureStep } from '@/lib/procedures/types';
import { useVoice } from '@/hooks/use-voice';
import { useToast } from '@/hooks/use-toast';

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
              <TabsTrigger value="metadata" className="text-[10px] uppercase font-bold px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
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

        <TabsContent value="metadata" className="mt-0 focus-visible:ring-0">
          <MetadataEditor 
            data={procedure.metadata || {}} 
            onChange={updateMetadata}
            activeField={activeField}
            onFieldFocus={setActiveField}
          />
        </TabsContent>

        <TabsContent value="steps" className="mt-0 focus-visible:ring-0">
          <StepEditor 
            steps={procedure.steps || []} 
            onChange={updateSteps}
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
