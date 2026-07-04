
"use client";

import { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  BrainCircuit,
  MessageSquare,
  ShieldCheck,
  Tag,
  Loader2,
  Trash2,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type KnowledgeType = 'qa' | 'manual' | 'technical_note';

interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  title: string;
  question?: string;
  answer?: string;
  tags: string[];
  category: string;
  isPublic: boolean;
  createdAt: string;
}

export default function DatasetPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInjecting, setIsInjecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // État du formulaire avec blindage anti-sérialisation
  const [newItem, setNewItem] = useState({
    type: 'qa' as KnowledgeType,
    title: '',
    question: '',
    answer: '',
    category: 'Général',
    tags: [] as string[]
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de lire le registre sémantique.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gestionnaire d'entrée blindé (V25.0)
   * Extrait explicitement la valeur pour empêcher l'erreur [object Event]
   */
  const handleFieldChange = (field: string, e: any) => {
    // Détection robuste du type d'entrée
    let value = '';
    if (e && e.target) {
      value = e.target.value;
    } else if (typeof e === 'string') {
      value = e;
    }

    setNewItem(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!newItem.tags.includes(tagInput.trim())) {
        setNewItem(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewItem(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleInject = async () => {
    if (!newItem.title || !newItem.answer) {
      toast({ title: "Champs requis", description: "Titre et Contenu/Réponse obligatoires.", variant: "destructive" });
      return;
    }

    setIsInjecting(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      
      if (res.ok) {
        toast({ title: "Injection réussie", description: "La donnée a été indexée dans le registre sémantique." });
        setShowAddForm(false);
        setNewItem({ type: 'qa', title: '', question: '', answer: '', category: 'Général', tags: [] });
        fetchItems();
      }
    } catch (e) {
      toast({ title: "Échec", description: "Erreur de liaison avec le centre de commande.", variant: "destructive" });
    } finally {
      setIsInjecting(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <BrainCircuit className="w-5 h-5" />
            <h1 className="text-xl font-headline font-bold uppercase tracking-tighter italic">Station d'Entraînement RAG</h1>
          </div>
          <p className="text-[10px] font-code text-muted-foreground uppercase tracking-widest">Alimentation du Registre de Connaissances Sémantiques</p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={cn(
              "h-9 text-[10px] font-bold uppercase tracking-widest",
              showAddForm ? "bg-muted text-white" : "bg-primary text-primary-foreground"
            )}
          >
            {showAddForm ? <X className="w-3.5 h-3.5 mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
            {showAddForm ? "Annuler" : "Nouvel Item"}
          </Button>
          <Button variant="outline" size="icon" onClick={fetchItems} className="h-9 w-9">
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <Card className="p-6 border-primary/30 bg-primary/5 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-primary tracking-widest">Titre Technique</label>
                <Input 
                  placeholder="EX: MAINTENANCE_POMPE_P101"
                  value={newItem.title}
                  onChange={(e) => handleFieldChange('title', e)}
                  className="bg-black/40 font-code text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-primary tracking-widest">Question / Déclencheur</label>
                <Input 
                  placeholder="Comment démarrer la pompe P101 ?"
                  value={newItem.question}
                  onChange={(e) => handleFieldChange('question', e)}
                  className="bg-black/40 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase text-primary tracking-widest">Catégorie</label>
                  <Input 
                    value={newItem.category}
                    onChange={(e) => handleFieldChange('category', e)}
                    className="bg-black/40 text-xs uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase text-primary tracking-widest">Tags (Entrée)</label>
                  <Input 
                    placeholder="EPI, POMPE, P101"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="bg-black/40 text-xs"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {newItem.tags.map(t => (
                  <Badge key={t} variant="secondary" className="text-[8px] uppercase gap-1">
                    {t} <X className="w-2 h-2 cursor-pointer" onClick={() => removeTag(t)} />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 h-full flex flex-col">
                <label className="text-[9px] font-bold uppercase text-primary tracking-widest">Réponse / Procédure de Connaissance</label>
                <Textarea 
                  placeholder="Instructions détaillées pour le moteur RAG..."
                  value={newItem.answer}
                  onChange={(e) => handleFieldChange('answer', e)}
                  className="flex-1 bg-black/40 font-code text-xs leading-relaxed min-h-[150px]"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              onClick={handleInject} 
              disabled={isInjecting}
              className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px] tracking-widest px-8"
            >
              {isInjecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <ShieldCheck className="w-3.5 h-3.5 mr-2" />}
              Injecter dans le Registre
            </Button>
          </div>
        </Card>
      )}

      {/* Barre de recherche */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Input 
          placeholder="RECHERCHER DANS LE REGISTRE SÉMANTIQUE (CODE, TAG, TITRE)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 bg-black/20 border-border font-code text-xs uppercase tracking-widest focus:border-primary/50"
        />
      </div>

      {/* Liste des items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="h-32 border-border bg-muted/5 animate-pulse" />
          ))
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <Database className="w-12 h-12 opacity-10" />
            <p className="text-xs font-code uppercase tracking-widest opacity-50">Aucun fragment sémantique détecté.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} className="group border-border bg-card/30 hover:border-primary/40 transition-all duration-300 overflow-hidden">
              <div className="p-4 flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-sm bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {item.type === 'qa' ? <MessageSquare className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-headline font-bold uppercase tracking-tight truncate text-white/90">
                      {item.title}
                    </h3>
                    <span className="text-[8px] font-code text-muted-foreground uppercase">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <p className="text-[10px] font-code text-muted-foreground leading-relaxed line-clamp-2 uppercase">
                    {item.answer || item.question}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge variant="outline" className="text-[7px] border-primary/20 text-primary py-0 px-1.5">{item.category}</Badge>
                    {item.tags.map(t => (
                      <Badge key={t} variant="secondary" className="text-[7px] bg-muted/50 py-0 px-1.5">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-0.5 w-0 bg-primary group-hover:w-full transition-all duration-500" />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
