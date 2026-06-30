"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetadataEditor } from './MetadataEditor';
import { StepEditor } from './StepEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Eye, Settings2, Layers } from 'lucide-react';
import { FullProcedure } from '@/lib/procedures/types';

interface DynamicProcedureFormProps {
  onSubmit: (data: any) => void;
  isSaving?: boolean;
}

export function DynamicProcedureForm({ onSubmit, isSaving }: DynamicProcedureFormProps) {
  const [activeTab, setActiveTab] = useState('metadata');
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

  const updateSteps = (steps: any[]) => {
    setProcedure(prev => ({ ...prev, steps }));
  };

  return (
    <div className="space-y-6 pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
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
          <MetadataEditor data={procedure.metadata} onChange={updateMetadata} />
        </TabsContent>

        <TabsContent value="steps" className="mt-0 focus-visible:ring-0">
          <StepEditor steps={procedure.steps || []} onChange={updateSteps} />
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
