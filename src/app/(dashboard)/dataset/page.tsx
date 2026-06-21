'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  FileJson, 
  ArrowRight, 
  UploadCloud, 
  FolderPlus, 
  ShieldCheck, 
  Info,
  Tag,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  HardDrive,
  Search
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface QAItem {
  id: string;
  question: string;
  answer: string;
}

interface MetadataField {
  key: string;
  value: string;
}

export default function DatasetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  // Submit modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [filename, setFilename] = useState('dataset-rag-custom');
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([
    { key: 'category', value: 'maintenance' },
    { key: 'collection', value: 'industrial_manuals' }
  ]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [lastIngestResult, setLastIngestResult] = useState<{
    filename: string;
    collection: string;
    count: number;
    indexed: boolean;
    savedTo: string;
  } | null>(null);

  // Add Q&A to accumulated list
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast({
        title: "Champs Requis",
        description: "Veuillez remplir la question et la réponse avant d'ajouter.",
        variant: "destructive"
      });
      return;
    }

    const newItem: QAItem = {
      id: `qa-${Date.now()}`,
      question: question.trim(),
      answer: answer.trim()
    };

    setItems(prev => [newItem, ...prev]);
    setQuestion('');
    setAnswer('');
    toast({
      title: "Paire Q/R Ajoutée",
      description: "La paire a été ajoutée à la liste accumulée ci-dessous.",
    });
  };

  // Start editing Q&A
  const startEditing = (item: QAItem) => {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
  };

  // Save edited Q&A
  const saveEdit = (id: string) => {
    if (!editQuestion.trim() || !editAnswer.trim()) {
      toast({
        title: "Modification Impossible",
        description: "Les champs question et réponse ne peuvent pas être vides.",
        variant: "destructive"
      });
      return;
    }

    setItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, question: editQuestion.trim(), answer: editAnswer.trim() } 
        : item
    ));
    setEditingId(null);
    toast({
      title: "Mise à jour réussie",
      description: "La paire Q/R a été mise à jour avec succès.",
    });
  };

  // Delete Q&A
  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    toast({
      title: "Élément supprimé",
      description: "La paire Q/R a été retirée de la liste.",
    });
  };

  // Add Metadata key/value
  const addMetadataField = () => {
    setMetadataFields(prev => [...prev, { key: '', value: '' }]);
  };

  // Remove Metadata key/value
  const removeMetadataField = (index: number) => {
    setMetadataFields(prev => prev.filter((_, i) => i !== index));
  };

  // Update Metadata field
  const updateMetadataField = (index: number, keyOrValue: 'key' | 'value', text: string) => {
    setMetadataFields(prev => prev.map((field, i) => 
      i === index ? { ...field, [keyOrValue]: text } : field
    ));
  };

  // Handle final JSONL save and RAG indexation
  const handleFinalSubmit = async () => {
    if (items.length === 0) return;
    if (!filename.trim()) {
      toast({
        title: "Nom de fichier requis",
        description: "Veuillez spécifier un nom de fichier pour le dataset.",
        variant: "destructive"
      });
      return;
    }

    setIsIngesting(true);
    const cleanedFilename = filename.trim().endsWith('.jsonl') ? filename.trim() : `${filename.trim()}.jsonl`;

    // Convert metadata fields array to object
    const metaObject: Record<string, string | number | boolean> = {};
    metadataFields.forEach(field => {
      if (field.key.trim()) {
        metaObject[field.key.trim()] = field.value.trim();
      }
    });

    try {
      const res = await apiClient.post<{ 
        success: boolean; 
        message: string;
        savedTo?: string;
        collection?: string;
        chromadb?: { status: string; indexed: boolean; error?: string };
      }>('/api/vector/ingest', {
        filename: cleanedFilename,
        items: items.map(item => ({ question: item.question, answer: item.answer })),
        metadata: metaObject
      });

      if (res.success) {
        const chromaIndexed = res.chromadb?.indexed;
        const collectionUsed = String(res.collection || metaObject.collection || 'industrial_manuals');
        
        if (chromaIndexed) {
          toast({
            title: "✅ Vectorisation ChromaDB réussie",
            description: `${items.length} paires Q/R indexées dans la collection "${collectionUsed}". Le chat IA peut maintenant les exploiter.`,
          });
        } else {
          toast({
            title: "⚠️ Fichier sauvegardé, ChromaDB hors-ligne",
            description: `${items.length} paires sauvegardées dans data/chromadb/datasets/. Démarrez ChromaDB (npm run chroma:start) pour la vectorisation.`,
            variant: "destructive"
          });
        }
        setItems([]);
        setShowSubmitModal(false);
        setLastIngestResult({
          filename: cleanedFilename,
          collection: collectionUsed,
          count: items.length,
          indexed: !!chromaIndexed,
          savedTo: res.savedTo || ''
        });
      } else {
        throw new Error(res.error || "Une erreur est survenue.");
      }
    } catch (e: any) {
      toast({
        title: "Échec d'ingestion",
        description: e.message || "Impossible d'indexer le fichier RAG.",
        variant: "destructive"
      });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto terminal-scroll">
        <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group"
              title="Retour"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[10px] font-code uppercase tracking-widest hidden sm:inline">Retour</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-headline font-bold text-sm uppercase tracking-widest text-primary">Générateur RAG & Datasets</span>
            </div>
            <div className="h-4 w-px bg-border mx-2" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
              <span className="text-[10px] font-code text-muted-foreground uppercase tracking-widest">Zone d'enrichissement IA</span>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto w-full space-y-8 flex-1">
          {/* RAG Connection Status Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-secondary/20 bg-secondary/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-secondary/20 flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4 text-secondary" />
              </div>
              <div className="font-code">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Sauvegarde</p>
                <p className="text-[11px] font-bold text-secondary">data/chromadb/datasets/</p>
              </div>
            </Card>
            <Card className="p-4 border-primary/20 bg-primary/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <div className="font-code">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Collection RAG</p>
                <p className="text-[11px] font-bold text-primary">industrial_manuals</p>
              </div>
            </Card>
            <Card className="p-4 border-border bg-black/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center shrink-0">
                <Search className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="font-code">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Exploitable par</p>
                <p className="text-[11px] font-bold text-foreground">Chat IA + Vision RAG</p>
              </div>
            </Card>
          </div>

          {/* Last ingest result banner */}
          {lastIngestResult && (
            <Card className={cn(
              "p-4 flex items-start gap-3 border",
              lastIngestResult.indexed 
                ? "border-secondary/30 bg-secondary/5" 
                : "border-yellow-500/30 bg-yellow-500/5"
            )}>
              {lastIngestResult.indexed 
                ? <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                : <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              }
              <div className="font-code text-xs space-y-1">
                <p className={cn("font-bold uppercase", lastIngestResult.indexed ? "text-secondary" : "text-yellow-500")}>
                  {lastIngestResult.indexed ? "✅ Dataset indexé dans ChromaDB" : "⚠️ Fichier sauvegardé (ChromaDB hors-ligne)"}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-bold">{lastIngestResult.count}</span> paires Q/R • Collection : <span className="text-primary">{lastIngestResult.collection}</span>
                </p>
                <p className="text-muted-foreground text-[10px] truncate">
                  Fichier : {lastIngestResult.savedTo || `data/chromadb/datasets/${lastIngestResult.filename}`}
                </p>
                {!lastIngestResult.indexed && (
                  <p className="text-yellow-500 text-[10px]">
                    Lancez <code className="bg-black/30 px-1 rounded">npm run chroma:start</code> pour activer la vectorisation
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Introduction Card */}
          <Card className="p-5 border-primary/20 bg-primary/5 flex items-start gap-4 shadow-[inset_0_0_15px_rgba(50,181,212,0.05)]">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 font-code text-xs">
              <p className="font-bold text-primary uppercase">&gt; Système d'enrichissement sémantique</p>
              <p className="text-muted-foreground uppercase leading-relaxed">
                Ajoutez des paires de questions et réponses techniques ci-dessous. Une fois vectorisées, ces connaissances seront immédiatement assimilées par le RAG de l'application et utilisables par le chat IA pour vous guider en direct.
              </p>
            </div>
          </Card>

          {/* Input Form */}
          <Card className="p-6 border-border bg-card/50 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-primary" />
              Nouvel Élément de Connaissance
            </h3>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase font-code text-muted-foreground tracking-wider">Question / Problème technique</label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ex: Que faire si le témoin de pression d'huile du panneau de contrôle clignote en rouge ?"
                    className="w-full h-24 bg-background/50 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-sm p-3 font-code text-xs leading-relaxed uppercase placeholder:text-muted-foreground/30 resize-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase font-code text-muted-foreground tracking-wider">Réponse / Procédure d'intervention</label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Ex: Couper immédiatement la vanne d'admission principale et vérifier le niveau du réservoir. Attendre 5 minutes avant réarmement."
                    className="w-full h-24 bg-background/50 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-sm p-3 font-code text-xs leading-relaxed uppercase placeholder:text-muted-foreground/30 resize-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className="bg-primary text-primary-foreground hover:bg-primary/95 font-headline font-bold uppercase tracking-widest text-[10px]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Ajouter à la liste
                </Button>
              </div>
            </form>
          </Card>

          {/* Accumulated List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-muted-foreground">
                Éléments accumulés ({items.length})
              </h3>
              {items.length > 0 && (
                <Button
                  onClick={() => setShowSubmitModal(true)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-headline font-bold uppercase tracking-widest text-[10px] h-8"
                >
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  Soumettre & Ingestion RAG
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-sm bg-black/10 text-muted-foreground">
                <FileJson className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-code text-[10px] uppercase tracking-widest text-center">Aucun élément accumulé dans ce dataset.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const isEditing = editingId === item.id;
                  return (
                    <Card key={item.id} className="p-4 border-border bg-black/20 hover:border-primary/30 transition-all flex flex-col md:flex-row gap-4 justify-between items-start">
                      <div className="flex gap-3 shrink-0">
                        <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-code text-[10px] font-bold">
                          {items.length - index}
                        </span>
                      </div>

                      <div className="flex-1 space-y-3 w-full">
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-3 w-full">
                            <input
                              type="text"
                              value={editQuestion}
                              onChange={(e) => setEditQuestion(e.target.value)}
                              className="w-full bg-background border border-border rounded-sm p-2 font-code text-xs uppercase text-foreground"
                            />
                            <textarea
                              value={editAnswer}
                              onChange={(e) => setEditAnswer(e.target.value)}
                              className="w-full bg-background border border-border rounded-sm p-2 font-code text-xs uppercase text-foreground h-16 resize-none"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2 font-code text-xs leading-relaxed">
                            <div className="p-2 border border-border/40 bg-background/30 rounded-sm">
                              <span className="text-[9px] font-bold text-primary uppercase block mb-1">Question</span>
                              <span className="text-foreground uppercase">{item.question}</span>
                            </div>
                            <div className="p-2 border border-border/40 bg-background/30 rounded-sm">
                              <span className="text-[9px] font-bold text-secondary uppercase block mb-1">Réponse</span>
                              <span className="text-foreground uppercase">{item.answer}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 shrink-0 self-end md:self-start">
                        {isEditing ? (
                          <>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-secondary hover:text-secondary-foreground hover:bg-secondary/20"
                              onClick={() => saveEdit(item.id)}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:border-primary/50"
                              onClick={() => startEditing(item)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Submit / Save Modal Dialog */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 border-primary/30 bg-card shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <FolderPlus className="w-5 h-5 text-primary" />
              <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-foreground">Enregistrement & Indexation</h3>
            </div>

            <div className="space-y-4">
              {/* Filename input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase font-code text-muted-foreground">Nom du fichier de destination (.jsonl)</label>
                <div className="flex items-center">
                  <Input
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="nom-du-dataset"
                    className="font-code text-xs uppercase rounded-r-none border-r-0 focus-visible:ring-0"
                    disabled={isIngesting}
                  />
                  <span className="bg-muted border border-l-0 border-border rounded-r-sm px-3 py-2 text-xs font-code text-muted-foreground">
                    .jsonl
                  </span>
                </div>
              </div>

              {/* Metadata editor */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold uppercase font-code text-muted-foreground">Métadonnées optionnelles (clé: valeur)</label>
                  <Button 
                    variant="ghost" 
                    className="text-[9px] font-code text-primary uppercase p-0 h-auto hover:bg-transparent"
                    onClick={addMetadataField}
                    disabled={isIngesting}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Ajouter
                  </Button>
                </div>
                
                <div className="max-h-36 overflow-y-auto space-y-2 pr-1 terminal-scroll">
                  {metadataFields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={field.key}
                        onChange={(e) => updateMetadataField(idx, 'key', e.target.value)}
                        placeholder="clé"
                        className="font-code text-xs uppercase h-8"
                        disabled={isIngesting}
                      />
                      <span className="text-muted-foreground font-code text-xs">:</span>
                      <Input
                        value={field.value}
                        onChange={(e) => updateMetadataField(idx, 'value', e.target.value)}
                        placeholder="valeur"
                        className="font-code text-xs uppercase h-8"
                        disabled={isIngesting}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-transparent"
                        onClick={() => removeMetadataField(idx)}
                        disabled={isIngesting}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                onClick={() => setShowSubmitModal(false)}
                className="font-headline font-bold uppercase tracking-widest text-[9px] h-9"
                disabled={isIngesting}
              >
                Annuler
              </Button>
              <Button
                onClick={handleFinalSubmit}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-headline font-bold uppercase tracking-widest text-[9px] h-9"
                disabled={isIngesting}
              >
                {isIngesting ? 'Vectorisation en cours...' : 'Valider & Indexer'}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
