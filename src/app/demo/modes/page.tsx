'use client';

import { ModeBadge, ModeDetailCard } from '@/components/ModeIndicator';
import { useAppMode } from '@/hooks/use-app-mode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ModeDemo() {
  const { mode, isDesktop, online, localOnly, setLocalOnly } = useAppMode();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Mode Demo
          </h1>
          <p className="text-slate-400 text-lg">
            Découvrez les trois modes d'opération de VisioNode
          </p>
        </div>

        {/* Current Mode Status */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle>Mode Actuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Badge:</span>
                <ModeBadge />
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-400">Mode: </span>
                  <span className="text-white font-medium capitalize">{mode}</span>
                </div>
                <div>
                  <span className="text-slate-400">Desktop: </span>
                  <span className={isDesktop ? 'text-green-400 font-medium' : 'text-slate-400'}>
                    {isDesktop ? 'Oui (Tauri)' : 'Non (Web)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Online: </span>
                  <span className={online ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                    {online ? 'Oui 🟢' : 'Non 🔴'}
                  </span>
                </div>
                {isDesktop && (
                  <div>
                    <span className="text-slate-400">Forcer Locale: </span>
                    <input
                      type="checkbox"
                      checked={localOnly}
                      onChange={(e) => setLocalOnly(e.target.checked)}
                      className="ml-2 w-4 h-4"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-400 space-y-3">
              <p>
                <strong className="text-white">Web Mode:</strong> Utilisateur accède via URL Vercel
              </p>
              <p>
                <strong className="text-white">Mode Hybride:</strong> App installée + connexion internet
              </p>
              <p>
                <strong className="text-white">Mode Offline:</strong> App autonome sans connexion
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mode Details */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Détails du Mode Actuel</h2>
          <ModeDetailCard />
        </div>

        {/* Mode Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Web Mode */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 hover:border-blue-500/60 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">☁️</span>
                <CardTitle className="text-blue-400">Mode Web</CardTitle>
              </div>
              <CardDescription>Cloud | Vercel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-slate-300">
                  <strong>Plateform:</strong> Vercel Cloud
                </p>
                <p className="text-slate-300">
                  <strong>Connexion:</strong> Toujours en ligne
                </p>
                <p className="text-slate-300">
                  <strong>Stockage:</strong> Cloud + Sync
                </p>
              </div>
              <div className="pt-4 border-t border-blue-500/30 space-y-2">
                <p className="text-xs font-semibold text-blue-300">Caractéristiques:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>✅ Pipeline IA complet</li>
                  <li>✅ Traitement Cloud haute perf</li>
                  <li>✅ Sync multi-appareils</li>
                  <li>✅ Support collaboratif</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Hybrid Mode */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/60 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔗</span>
                <CardTitle className="text-purple-400">Mode Hybride</CardTitle>
              </div>
              <CardDescription>Local + Cloud Bridge</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-slate-300">
                  <strong>Plateform:</strong> App Tauri + Cloud
                </p>
                <p className="text-slate-300">
                  <strong>Connexion:</strong> Online optimisé
                </p>
                <p className="text-slate-300">
                  <strong>Stockage:</strong> Hybride (Local + Cloud)
                </p>
              </div>
              <div className="pt-4 border-t border-purple-500/30 space-y-2">
                <p className="text-xs font-semibold text-purple-300">Caractéristiques:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>⚡ Traitement local rapide</li>
                  <li>🔄 Sync automatique</li>
                  <li>📦 Cache intelligent</li>
                  <li>🔋 Prêt pour offline</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Local Mode */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 hover:border-amber-500/60 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⚡</span>
                <CardTitle className="text-amber-400">Mode Offline</CardTitle>
              </div>
              <CardDescription>Autonome 100%</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-slate-300">
                  <strong>Plateform:</strong> App Tauri Native
                </p>
                <p className="text-slate-300">
                  <strong>Connexion:</strong> Aucune requise
                </p>
                <p className="text-slate-300">
                  <strong>Stockage:</strong> Local SQLite
                </p>
              </div>
              <div className="pt-4 border-t border-amber-500/30 space-y-2">
                <p className="text-xs font-semibold text-amber-300">Caractéristiques:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>🔒 Entièrement privé</li>
                  <li>⚡ Ultra rapide</li>
                  <li>🔋 Pas de batterie</li>
                  <li>🛡️ Sécurisé local</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-slate-500">
          <p>Mode Detection System • Tailwind CSS • Responsive Design</p>
        </div>
      </div>
    </div>
  );
}
