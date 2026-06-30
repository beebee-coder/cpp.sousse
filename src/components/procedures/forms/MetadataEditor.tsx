"use client";

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProcedureMetadata } from '@/lib/procedures/types';

interface MetadataEditorProps {
  data: Partial<ProcedureMetadata>;
  onChange: (data: any) => void;
}

export function MetadataEditor({ data, onChange }: MetadataEditorProps) {
  return (
    <Card className="p-6 border-border bg-card/40 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Identification */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] border-b border-primary/20 pb-2">Identification</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Titre de la procédure</label>
              <Input 
                value={data.title} 
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="EX: DÉMARRAGE POMPE CRF" 
                className="bg-black/40 border-border uppercase font-headline font-bold text-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Code Système</label>
                <Input 
                  value={data.code} 
                  onChange={(e) => onChange({ code: e.target.value })}
                  placeholder="CODE_001" 
                  className="bg-black/40 border-border font-code text-xs"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Version</label>
                <Input 
                  value={data.version} 
                  onChange={(e) => onChange({ version: e.target.value })}
                  placeholder="1.0.0" 
                  className="bg-black/40 border-border font-code text-xs"
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
              <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Catégorie</label>
              <Select value={data.category} onValueChange={(val) => onChange({ category: val })}>
                <SelectTrigger className="bg-black/40 border-border text-[10px] uppercase font-bold h-10">
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
              <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Criticité</label>
              <Select value={data.criticality} onValueChange={(val) => onChange({ criticality: val })}>
                <SelectTrigger className="bg-black/40 border-border text-[10px] uppercase font-bold h-10">
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
        <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1.5">Description Technique Globale</label>
        <Textarea 
          placeholder="Objectifs et périmètre de la procédure..." 
          className="bg-black/40 border-border font-code text-xs h-32 resize-none"
        />
      </div>
    </Card>
  );
}
