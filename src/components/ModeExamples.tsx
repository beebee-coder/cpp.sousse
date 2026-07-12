'use client';

/**
 * 📚 EXAMPLES - Mode System Integration Patterns
 * 
 * Copy-paste examples pour intégrer le système de modes dans vos pages
 */

import { useAppMode } from '@/hooks/use-app-mode';
import { ModeBadge, ModeDetailCard } from '@/components/ModeIndicator';
import { ModeLiveIndicator, ModeContextMenu } from '@/components/ModeLiveIndicator';
import { ModeStatusWidget } from '@/components/ModeStatusWidget';

// ============================================================================
// EXAMPLE 1: Simple Badge Display
// ============================================================================
export function Example1_SimpleBadge() {
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4">Simple Badge</h3>
      <ModeBadge />
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Mode-Aware Content (different content per mode)
// ============================================================================
export function Example2_ModeAwareContent() {
  const { mode } = useAppMode();

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Mode-Aware Content</h3>

      {mode === 'web' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
          <p className="text-blue-300">
            ☁️ You're in Web Mode - all features available from the cloud
          </p>
        </div>
      )}

      {mode === 'hybride' && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded p-4">
          <p className="text-purple-300">
            🔗 You're in Hybrid Mode - using local cache with cloud sync
          </p>
        </div>
      )}

      {mode === 'locale' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-4">
          <p className="text-amber-300">
            ⚡ You're in Offline Mode - working completely locally
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Conditional Features
// ============================================================================
export function Example3_ConditionalFeatures() {
  const { mode, online } = useAppMode();

  const canSync = mode !== 'locale' && online;
  const canUseCloud = mode === 'web' || (mode === 'hybride' && online);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Conditional Features</h3>

      {canSync && (
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          🔄 Sync Now
        </button>
      )}

      {canUseCloud && (
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
          ☁️ Upload to Cloud
        </button>
      )}

      {!canSync && (
        <p className="text-slate-400 text-sm">
          Sync disabled in offline mode
        </p>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Mode Status with Toggle (for hybrid mode)
// ============================================================================
export function Example4_HybridToggle() {
  const { mode, localOnly, setLocalOnly } = useAppMode();

  if (mode !== 'hybride') {
    return (
      <div className="p-4 text-slate-400 text-sm">
        Toggle only available in Hybrid Mode
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Hybrid Mode Options</h3>
      <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-800/50">
        <input
          type="checkbox"
          checked={localOnly}
          onChange={(e) => setLocalOnly(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm">Force local-only mode</span>
      </label>
      {localOnly && (
        <p className="text-xs text-amber-300">
          ⚡ Local-only mode enabled - sync disabled
        </p>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Header Integration
// ============================================================================
export function Example5_HeaderBar() {
  return (
    <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-white">My App</h1>
      <ModeLiveIndicator variant="full" />
    </div>
  );
}

// ============================================================================
// EXAMPLE 6: Dashboard with Mode Info
// ============================================================================
export function Example6_DashboardOverview() {
  const { mode, online, isDesktop } = useAppMode();

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {/* Card 1: Current Mode */}
        <div className="bg-slate-900 border border-slate-700 rounded p-4">
          <div className="text-sm text-slate-400 mb-2">Current Mode</div>
          <div className="flex items-center gap-2">
            <ModeBadge />
          </div>
        </div>

        {/* Card 2: Connection Status */}
        <div className="bg-slate-900 border border-slate-700 rounded p-4">
          <div className="text-sm text-slate-400 mb-2">Connection</div>
          <div className={`text-lg font-bold ${online ? 'text-green-400' : 'text-red-400'}`}>
            {online ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>

        {/* Card 3: Platform */}
        <div className="bg-slate-900 border border-slate-700 rounded p-4">
          <div className="text-sm text-slate-400 mb-2">Platform</div>
          <div className="text-lg font-bold text-slate-300">
            {isDesktop ? '🖥️ Desktop' : '🌐 Web'}
          </div>
        </div>
      </div>

      {/* Detailed Info */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4">
        <h3 className="font-bold text-white mb-3">Mode Details</h3>
        <ModeDetailCard />
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 7: Sidebar Footer Widget
// ============================================================================
export function Example7_SidebarFooter() {
  return (
    <div className="border-t border-slate-700 p-4">
      <ModeStatusWidget />
    </div>
  );
}

// ============================================================================
// EXAMPLE 8: Notification Banner
// ============================================================================
export function Example8_NotificationBanner() {
  const { mode, online } = useAppMode();

  if (mode === 'web' || (mode === 'hybride' && online)) {
    return null; // Don't show if everything is normal
  }

  return (
    <div className="bg-amber-900/30 border-b border-amber-700 px-4 py-3 text-sm text-amber-200">
      {mode === 'locale' && (
        '⚡ Working offline - changes saved locally and will sync when connected'
      )}
      {mode === 'hybride' && !online && (
        '🔗 Hybrid mode - offline - using local cache'
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 9: Complete Page with Mode Awareness
// ============================================================================
export function Example9_CompletePage() {
  const { mode, online } = useAppMode();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <ModeLiveIndicator variant="full" />
      </header>

      {/* Notification */}
      <Example8_NotificationBanner />

      {/* Main Content */}
      <main className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-6">
          {/* Current Status */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Status</h2>
            <Example2_ModeAwareContent />
          </div>

          {/* Available Actions */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Actions</h2>
            <Example3_ConditionalFeatures />
          </div>
        </div>

        {/* Detailed Info */}
        <div className="mt-6 bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Details</h2>
          <ModeDetailCard />
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================
export const EXAMPLES = [
  { name: 'Simple Badge', component: Example1_SimpleBadge },
  { name: 'Mode-Aware Content', component: Example2_ModeAwareContent },
  { name: 'Conditional Features', component: Example3_ConditionalFeatures },
  { name: 'Hybrid Toggle', component: Example4_HybridToggle },
  { name: 'Header Bar', component: Example5_HeaderBar },
  { name: 'Dashboard Overview', component: Example6_DashboardOverview },
  { name: 'Sidebar Footer', component: Example7_SidebarFooter },
  { name: 'Notification Banner', component: Example8_NotificationBanner },
  { name: 'Complete Page', component: Example9_CompletePage },
];
