"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Edit3,
  Image,
  Video,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

export interface MediaEditorProps {
  step: {
    media?: {
      image?: { url: string; caption?: string; alt?: string };
      video?: { url: string; caption?: string };
      diagram?: { url: string; caption?: string };
    };
  };
  stepIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onAddMedia: (stepIndex: number, field: 'image' | 'video' | 'diagram', value: string) => void;
  onRemoveMedia: (stepIndex: number, field: 'image' | 'video' | 'diagram') => void;
  onUpdateCaption: (stepIndex: number, field: 'image' | 'video' | 'diagram', caption: string) => void;
}

type MediaField = 'image' | 'video' | 'diagram';

export function MediaEditor({
  step,
  stepIndex,
  open,
  onOpenChange,
  onSave,
  onAddMedia,
  onRemoveMedia,
  onUpdateCaption,
}: MediaEditorProps) {
  const t = useTranslation();
  const [localImageCaption, setLocalImageCaption] = useState(step.media?.image?.caption || '');
  const [localVideoCaption, setLocalVideoCaption] = useState(step.media?.video?.caption || '');
  const [localDiagramCaption, setLocalDiagramCaption] = useState(step.media?.diagram?.caption || '');
  const [loadingFields, setLoadingFields] = useState<Record<MediaField, boolean>>({
    image: false,
    video: false,
    diagram: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewErrors, setPreviewErrors] = useState<Record<MediaField, boolean>>({
    image: false,
    video: false,
    diagram: false,
  });

  useEffect(() => {
    if (!open) return;
    setLocalImageCaption(step.media?.image?.caption || '');
    setLocalVideoCaption(step.media?.video?.caption || '');
    setLocalDiagramCaption(step.media?.diagram?.caption || '');
    setLoadingFields({ image: false, video: false, diagram: false });
    setIsSaving(false);
    setSaveSuccess(false);
    setPreviewErrors({ image: false, video: false, diagram: false });
  }, [open, step.media?.image?.caption, step.media?.video?.caption, step.media?.diagram?.caption]);

  const handleFieldChange = useCallback((field: MediaField, value: string) => {
    setLoadingFields(prev => ({ ...prev, [field]: true }));
    setPreviewErrors(prev => ({ ...prev, [field]: false }));
    onAddMedia(stepIndex, field, value);

    if (value && value.length > 5) {
      const timer = setTimeout(() => {
        setLoadingFields(prev => ({ ...prev, [field]: false }));
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setLoadingFields(prev => ({ ...prev, [field]: false }));
    }
  }, [stepIndex, onAddMedia]);

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange('image', e.target.value);
  };

  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange('video', e.target.value);
  };

  const handleDiagramUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange('diagram', e.target.value);
  };

  const handleImageCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalImageCaption(e.target.value);
    onUpdateCaption(stepIndex, 'image', e.target.value);
  };

  const handleVideoCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVideoCaption(e.target.value);
    onUpdateCaption(stepIndex, 'video', e.target.value);
  };

  const handleDiagramCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramCaption(e.target.value);
    onUpdateCaption(stepIndex, 'diagram', e.target.value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    await new Promise(resolve => setTimeout(resolve, 600));
    setIsSaving(false);
    setSaveSuccess(true);
    onSave();
    setTimeout(() => {
      setSaveSuccess(false);
      onOpenChange(false);
    }, 1200);
  };

  const handleImageError = () => setPreviewErrors(prev => ({ ...prev, image: true }));
  const handleVideoError = () => setPreviewErrors(prev => ({ ...prev, video: true }));
  const handleDiagramError = () => setPreviewErrors(prev => ({ ...prev, diagram: true }));

  const imageUrl = step.media?.image?.url || '';
  const videoUrl = step.media?.video?.url || '';
  const diagramUrl = step.media?.diagram?.url || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
              <span className="text-xs font-code font-bold text-primary">É{stepIndex + 1}</span>
            </div>
            <div>
              <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">
                Édition des médias — Étape {stepIndex + 1}
              </DialogTitle>
              <p className="text-tiny font-code text-muted-foreground mt-0.5">
                Collez une {t('common.url')} publique pour afficher l'aperçu
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Image */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-primary" />
                <span className="text-tiny font-bold text-primary uppercase">{t('common.image')}</span>
                {loadingFields.image && (
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                )}
              </div>

              {imageUrl && !previewErrors.image ? (
                <div className="space-y-3">
                  <div className="aspect-video bg-black/40 rounded-sm border border-border overflow-hidden relative">
                    <img
                      src={imageUrl}
                      alt={step.media?.image?.caption || 'Preview'}
                      className="w-full h-full object-cover"
                       onError={handleImageError}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className="text-micro font-code bg-secondary/20 text-secondary border-secondary/40">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Chargé
                      </Badge>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={handleImageUrlChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.url')} de l'image"
                  />
                  <input
                    type="text"
                    value={localImageCaption}
                    onChange={handleImageCaptionChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.caption')} de l'image"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemoveMedia(stepIndex, 'image')}
                    className="w-full text-tiny border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    {t('common.delete')} l'image
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-video bg-black/20 rounded-sm border border-dashed border-border flex items-center justify-center">
                    {loadingFields.image ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : previewErrors.image ? (
                      <div className="text-center px-4">
                        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                        <p className="text-micro font-code text-destructive">{t('common.invalidUrl')}</p>
                      </div>
                    ) : (
                      <Image className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={handleImageUrlChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.pasteUrl')} de l'image"
                  />
                </div>
              )}
            </div>

            {/* Video */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span className="text-tiny font-bold text-primary uppercase">{t('common.video')}</span>
                {loadingFields.video && (
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                )}
              </div>

              {videoUrl && !previewErrors.video ? (
                <div className="space-y-3">
                  <div className="aspect-video bg-black/40 rounded-sm border border-border overflow-hidden relative">
                    <video
                      src={videoUrl}
                      className="w-full h-full object-cover"
                      controls
                      onError={handleVideoError}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className="text-micro font-code bg-secondary/20 text-secondary border-secondary/40">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Chargé
                      </Badge>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={handleVideoUrlChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.url')} de la vidéo"
                  />
                  <input
                    type="text"
                    value={localVideoCaption}
                    onChange={handleVideoCaptionChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.caption')} de la vidéo"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemoveMedia(stepIndex, 'video')}
                    className="w-full text-tiny border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    {t('common.delete')} la vidéo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-video bg-black/20 rounded-sm border border-dashed border-border flex items-center justify-center">
                    {loadingFields.video ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : previewErrors.video ? (
                      <div className="text-center px-4">
                        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                        <p className="text-micro font-code text-destructive">{t('common.invalidUrl')}</p>
                      </div>
                    ) : (
                      <Video className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={handleVideoUrlChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.pasteUrl')} de la vidéo (mp4, webm)"
                  />
                </div>
              )}
            </div>

            {/* Diagram */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-tiny font-bold text-primary uppercase">{t('common.diagram')}</span>
                {loadingFields.diagram && (
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                )}
              </div>

              {diagramUrl && !previewErrors.diagram ? (
                <div className="space-y-3">
                  <div className="aspect-video bg-black/40 rounded-sm border border-border flex items-center justify-center relative">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center mx-auto mb-2">
                        <span className="text-sm font-code font-bold text-primary">PDF</span>
                      </div>
                      <p className="text-tiny font-code text-white/80 truncate px-4">
                        {step.media?.diagram?.caption || t('common.document')}
                      </p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge className="text-micro font-code bg-secondary/20 text-secondary border-secondary/40">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Chargé
                      </Badge>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={diagramUrl}
                    onChange={handleDiagramUrlChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder={`${t('common.url')} du document`}
                  />
                  <input
                    type="text"
                    value={localDiagramCaption}
                    onChange={handleDiagramCaptionChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder={`${t('common.caption')} du document`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemoveMedia(stepIndex, 'diagram')}
                    className="w-full text-tiny border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    {t('common.delete')} le document
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-video bg-black/20 rounded-sm border border-dashed border-border flex items-center justify-center">
                    {loadingFields.diagram ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : previewErrors.diagram ? (
                      <div className="text-center px-4">
                        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                        <p className="text-micro font-code text-destructive">{t('common.invalidUrl')}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-2">
                          <span className="text-sm font-code font-bold text-muted-foreground/50">PDF</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={diagramUrl}
                    onChange={handleDiagramUrlChange}
                    className="w-full h-9 px-3 text-tiny font-code terminal-card text-white focus:outline-none focus:border-primary"
                    placeholder="{t('common.pasteUrl')} du PDF / schéma"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-3 terminal-card">
            <p className="text-tiny font-code text-muted-foreground">
              <span className="text-primary font-bold">{t('common.tip')} :</span> Utilisez des {t('common.url')}s publiques (Vercel Blob, CDN, S3) pour les médias. La sauvegarde est locale jusqu'à intégration backend.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border bg-card/30">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-secondary">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-tiny font-code uppercase">{t('common.saved')}</span>
                </div>
              )}
              {isSaving && (
                <div className="flex items-center gap-1.5 text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-tiny font-code uppercase">Sauvegarde...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="h-9 text-tiny uppercase"
              >
                <X className="w-3.5 h-3.5 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 text-tiny uppercase btn-secondary-glow"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                    {t('common.saved')}
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-2" />
                    {t('common.save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
