'use client';

import React from 'react';
import { useAppMode } from '@/hooks/use-app-mode';

/**
 * Badge innovant affichant le mode actif
 * Web : design cloud/réseau
 * Hybride : design fusion/bridge
 * Locale : design offline/batterie
 */
export function ModeBadge() {
  const { mode, isReady, online } = useAppMode();

  if (!isReady) return null;

  const badgeConfig = {
    web: {
      gradient: 'from-blue-500 to-cyan-400',
      icon: '☁️',
      label: 'Web',
      description: 'Cloud | Vercel',
      glow: 'shadow-lg shadow-blue-500/50',
      dot: 'bg-blue-400 animate-pulse',
      dotOffline: 'bg-blue-400 animate-pulse',
    },
    hybride: {
      gradient: 'from-purple-500 to-pink-400',
      icon: '🔗',
      label: 'Hybride',
      description: 'Local + Cloud',
      glow: 'shadow-lg shadow-purple-500/50',
      dot: 'bg-purple-400',
      dotOffline: 'bg-red-500 animate-pulse', // Rouge si offline
    },
    locale: {
      gradient: 'from-amber-500 to-orange-400',
      icon: '⚡',
      label: 'Locale',
      description: 'Offline',
      glow: 'shadow-lg shadow-amber-500/50',
      dot: 'bg-amber-400 animate-bounce',
      dotOffline: 'bg-amber-400 animate-bounce',
    },
  };

  const config = badgeConfig[mode];
  const dotClass = mode === 'hybride' && !online ? config.dotOffline : config.dot;

  return (
    <div className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r ${config.gradient} ${config.glow} text-white font-semibold transition-all duration-300 hover:scale-110`}>
      {/* Pulsing background glow */}
      <div className={`absolute inset-0 rounded-full ${config.gradient.replace('to-', 'to-').replace('from-', 'from-')} opacity-30 animate-pulse blur`} />

      {/* Animated dot - rouge si offline */}
      <span className={`absolute inline-block w-2 h-2 rounded-full ${dotClass}`} style={{right: '2px', bottom: '2px'}} />

      {/* Icon only */}
      <span className="relative text-lg" title={mode === 'hybride' && !online ? 'Mode Hybride - Offline' : undefined}>{config.icon}</span>

      {/* Subtle shine effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * Card infos détaillées du mode (optionnel - pour dashboard)
 */
export function ModeDetailCard() {
  const { mode, online, localOnly, setLocalOnly } = useAppMode();

  const details = {
    web: {
      title: 'Mode Cloud',
      description: 'Connecté à Vercel Cloud - Accès illimité aux ressources cloud',
      features: ['✅ Traitement Cloud', '✅ Sauvegarde Cloud', '✅ IA Full', '✅ Sync Multi-appareils'],
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    hybride: {
      title: mode !== 'hybride' ? 'Mode Hybride' : (online ? 'Mode Hybride - Online' : 'Mode Hybride - Offline'),
      description: 'Application locale avec synchronisation cloud',
      features: ['✅ Processing Local', '✅ Cache Local', '✅ Sync Cloud', '⚡ Travail Offline'],
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    locale: {
      title: 'Mode Offline',
      description: 'Fonctionnement complètement autonome - aucune connexion requise',
      features: ['🔋 Autonome', '💾 Cache Local', '⚡ Rapide', '🔒 Privé'],
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
  };

  const detail = details[mode];

  return (
    <div className={`rounded-lg border ${detail.borderColor} ${detail.bgColor} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-bold ${detail.color}`}>{detail.title}</h3>
        <span className={`text-sm font-medium ${online ? 'text-green-500' : 'text-red-500'}`}>
          {online ? '🟢 Online' : '🔴 Offline'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{detail.description}</p>
      <div className="space-y-1">
        {detail.features.map((feature) => (
          <div key={feature} className="text-xs text-muted-foreground">
            {feature}
          </div>
        ))}
      </div>
      
      {mode === 'hybride' && (
        <div className="mt-4 pt-4 border-t border-purple-500/30">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localOnly}
              onChange={(e) => setLocalOnly(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs font-medium">Forcer mode locale uniquement</span>
          </label>
        </div>
      )}
    </div>
  );
}
