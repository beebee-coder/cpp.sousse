"use client";

import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProcedureMetadata } from '@/lib/procedures/types';
import { useVoice } from '@/hooks/use-voice';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ForgeField = 
  | 'title'
  | 'code'
  | 'version'
  | 'description'
  | 'category'
  | 'criticality';

interface MetadataEditorProps {
  data: Partial<ProcedureMetadata>;
  onChange: (data: any) => void;
  activeField: ForgeField;
  onFieldFocus: (field: ForgeField) => void;
}

export function MetadataEditor({ data, onChange, activeField, onFieldFocus }: MetadataEditorProps) {
  const { toast } = useToast();
  const lastTranscriptRef = useRef('');
  const sectionRef = useRef<HTMLDivElement>(null);

  const parseVoiceCommand = useCallback((raw: string, currentField: ForgeField) => {
    const t = raw.trim();
    const lower = t.toLowerCase();

    const fieldPatterns: { field: ForgeField; patterns: RegExp[] }[] = [
      { field: 'title', patterns: [/^(?:titre|nom)[\s:]+(.+)$/i, /^(?:proc.dure|titre de la proc.dure)[\s:]+(.+)$/i] },
      { field: 'code', patterns: [/^(?:code|r.f.rence|code syst.me)[\s:]+(.+)$/i] },
      { field: 'version', patterns: [/^(?:version|v)[\s:]+(.+)$/i] },
      { field: 'description', patterns: [/^(?:description|contexte|d.scrire)[\s:]+(.+)$/i] },
      { field: 'category', patterns: [/^(?:cat.gorie|categorie)[\s:]+(.+)$/i] },
      { field: 'criticality', patterns: [/^(?:criticit.|niveau)[\s:]+(.+)$/i] },
    ];

    for (const { field, patterns } of fieldPatterns) {
      for (const regex of patterns) {
        const match = t.match(regex);
        if (match && match[1]) {
          return { field, text: match[1].trim() };
        }
      }
    }

    if (/^(?:annuler|effacer|supprimer|vider|non|annule)[\s.!?]*$/i.test(lower)) {
      return { field: currentField, text: '', action: 'clear' as const };
    }

    return { field: currentField, text: t };
  }, []);

  const applyToField = useCallback((field: ForgeField, text: string) => {
    if (field === 'title') onChange({ title: text });
    else if (field === 'code') onChange({ code: text });
    else if (field === 'version') onChange({ version: text });
    else if (field === 'description') onChange({ description: text });
    else if (field === 'category') onChange({ category: text });
    else if (field === 'criticality') onChange({ criticality: text });
  }, [onChange]);

  const voice = useVoice({
    onResult: (text) => {
      lastTranscriptRef.current = text;
      const parsed = parseVoiceCommand(text, activeField);
      
      if (parsed.action === 'clear') {
        applyToField(parsed.field, '');
        toast({ title: 'Correction vocale', description: 'Champ effacé.' });
        return;
      }

      onFieldFocus(parsed.field);
      applyToField(parsed.field, parsed.text);
    },
    onCorrection: () => {
      applyToField(activeField, '');
      toast({ title: 'Correction vocale', description: 'Dernière reconnaissance supprimée.' });
    },
    autoRestart: false,
    lang: 'fr-FR'
  });

  const getActiveVoice = () => voice;

  return (
    <Card className="p-6 panel-card space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Identification */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] border-b border-primary/20 pb-2">Identification</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Titre de la procédure</label>
              <Input 
                value={data.title} 
                onChange={(e) => onChange({ title: e.target.value })}
                onFocus={() => onFieldFocus('title')}
                placeholder="EX: DÉMARRAGE POMPE CRF" 
                className={`bg-black/40 border font-headline font-bold text-sm ${activeField === 'title' ? 'border-primary' : 'border-border'}`}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Code Système</label>
                <Input 
                  value={data.code} 
                  onChange={(e) => onChange({ code: e.target.value })}
                  onFocus={() => onFieldFocus('code')}
                  placeholder="CODE_001" 
                  className={`bg-black/40 border font-code text-xs ${activeField === 'code' ? 'border-primary' : 'border-border'}`}
                />
              </div>
              <div>
                <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Version</label>
                <Input 
                  value={data.version} 
                  onChange={(e) => onChange({ version: e.target.value })}
                  onFocus={() => onFieldFocus('version')}
                  placeholder="1.0.0" 
                  className={`bg-black/40 border font-code text-xs ${activeField === 'version' ? 'border-primary' : 'border-border'}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] border-b border-secondary/20 pb-2">Classification</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Catégorie</label>
              <Select value={data.category} onValueChange={(val) => onChange({ category: val })}>
                <SelectTrigger className={`bg-black/40 border h-10 ${activeField === 'category' ? 'border-primary' : 'border-border'}`}>
                  <SelectValue placeholder="SÉLECTION" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="STARTUP">DÉMARRAGE</SelectItem>
                  <SelectItem value="SHUTDOWN">ARRÊT</SelectItem>
                  <SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem>
                  <SelectItem value="EMERGENCY">URGENCE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Criticité</label>
              <Select value={data.criticality} onValueChange={(val) => onChange({ criticality: val })}>
                <SelectTrigger className={`bg-black/40 border h-10 ${activeField === 'criticality' ? 'border-primary' : 'border-border'}`}>
                  <SelectValue placeholder="SÉLECTION" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="LOW">BASSE</SelectItem>
                  <SelectItem value="MEDIUM">MOYENNE</SelectItem>
                  <SelectItem value="HIGH">HAUTE</SelectItem>
                  <SelectItem value="CRITICAL">CRITIQUE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <label className="text-tiny font-bold uppercase text-muted-foreground block mb-1.5">Description Technique Globale</label>
        <Textarea 
          placeholder="Objectifs et périmètre de la procédure..." 
          onFocus={() => onFieldFocus('description')}
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={`bg-black/40 border font-code text-xs h-32 resize-none ${activeField === 'description' ? 'border-primary' : 'border-border'}`}
        />
      </div>
    </Card>
  );
}
