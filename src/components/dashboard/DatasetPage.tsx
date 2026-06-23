// src/components/dashboard/DatasetPage.tsx
'use client';

import { useVoice } from '@/hooks/use-voice';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

export function DatasetPage() {
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const { toast } = useToast();

  const {
    isListening,
    isSupported,
    error,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    speak,
    checkPermissions
  } = useVoice({
    lang: 'fr-FR',
    continuous: true,
    interimResults: true,
    autoRestart: true,
    onResult: (text) => {
      console.log('[DATASET_AUDIT] Nouveau texte:', text);
      setTranscripts(prev => [...prev, text]);
      // Envoyer au backend
      sendToDataset(text);
    },
    onError: (error) => {
      toast({
        title: '❌ Erreur vocale',
        description: error,
        variant: 'destructive'
      });
    }
  });

  useEffect(() => {
    // Vérifier les permissions au montage
    checkPermissions();
  }, [checkPermissions]);

  const sendToDataset = async (text: string) => {
    try {
      const response = await fetch('/api/dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, timestamp: new Date().toISOString() })
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi');
      }
      
      toast({
        title: '✅ Enregistré',
        description: 'Texte ajouté au dataset',
      });
    } catch (error) {
      console.error('[DATASET_AUDIT] Erreur:', error);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 text-red-600">
        ⚠️ La reconnaissance vocale n'est pas supportée par votre navigateur.
        <br />
        <span className="text-sm text-gray-500">
          Utilisez Chrome, Edge ou Safari récent.
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-4 items-center">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isListening ? '🛑 Arrêter' : '🎙️ Démarrer'}
        </button>
        
        {error && (
          <span className="text-red-500 text-sm">{error}</span>
        )}
      </div>

      {interimTranscript && (
        <div className="text-gray-400 italic text-sm">
          🖊️ {interimTranscript}
        </div>
      )}

      {transcript && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="font-medium">📝 {transcript}</p>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Historique ({transcripts.length})</h3>
        {transcripts.map((text, i) => (
          <div key={i} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}