'use client';

import { useState } from 'react';
import { EXAMPLES } from '@/components/ModeExamples';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ModeExamplesPage() {
  const [selectedExample, setSelectedExample] = useState(0);

  const Example = EXAMPLES[selectedExample].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            Mode System Examples
          </h1>
          <p className="text-slate-400">
            Copy-paste ready examples for integrating the mode system
          </p>
        </div>

        {/* Example Selector */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {EXAMPLES.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedExample(idx)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedExample === idx
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {example.name}
            </button>
          ))}
        </div>

        {/* Example Display */}
        <Card className="bg-slate-900/50 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle>{EXAMPLES[selectedExample].name}</CardTitle>
            <CardDescription>
              Click on example buttons above to switch between different integration patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-slate-950/50 p-6 border border-slate-700/50">
              <Example />
            </div>
          </CardContent>
        </Card>

        {/* Integration Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg">📌 Quick Integration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-2">
              <p>1. Import the mode hook or components</p>
              <code className="bg-slate-950 p-2 rounded block text-xs">
                import {'{useAppMode}'} from '@/hooks/use-app-mode'
              </code>
              <p>2. Use in your component</p>
              <code className="bg-slate-950 p-2 rounded block text-xs">
                const {'{mode, isOnline}'} = useAppMode()
              </code>
              <p>3. Add conditional logic</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg">🎨 Component Exports</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-2">
              <p>
                <code className="bg-slate-950 px-2 py-1 rounded text-xs">ModeBadge</code> - Main badge
              </p>
              <p>
                <code className="bg-slate-950 px-2 py-1 rounded text-xs">ModeDetailCard</code> - Details
              </p>
              <p>
                <code className="bg-slate-950 px-2 py-1 rounded text-xs">ModeLiveIndicator</code> - Live status
              </p>
              <p>
                <code className="bg-slate-950 px-2 py-1 rounded text-xs">ModeStatusWidget</code> - Sidebar widget
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Code Examples */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle>Code Snippets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Snippet 1 */}
              <div>
                <h4 className="font-semibold text-white mb-2">Display Current Mode</h4>
                <pre className="bg-slate-950/70 p-4 rounded text-xs text-slate-300 overflow-x-auto">
{`import { useAppMode } from '@/hooks/use-app-mode';

export function MyComponent() {
  const { mode } = useAppMode();
  
  return <div>Current: {mode}</div>;
}`}
                </pre>
              </div>

              {/* Snippet 2 */}
              <div>
                <h4 className="font-semibold text-white mb-2">Mode-Aware Content</h4>
                <pre className="bg-slate-950/70 p-4 rounded text-xs text-slate-300 overflow-x-auto">
{`import { useAppMode } from '@/hooks/use-app-mode';

export function Content() {
  const { mode } = useAppMode();
  
  if (mode === 'locale') {
    return <div>Offline mode</div>;
  }
  
  if (mode === 'hybride') {
    return <div>Hybrid mode with sync</div>;
  }
  
  return <div>Cloud mode</div>;
}`}
                </pre>
              </div>

              {/* Snippet 3 */}
              <div>
                <h4 className="font-semibold text-white mb-2">Badge in Header</h4>
                <pre className="bg-slate-950/70 p-4 rounded text-xs text-slate-300 overflow-x-auto">
{`import { ModeLiveIndicator } from '@/components/ModeLiveIndicator';

export function Header() {
  return (
    <header className="flex justify-between items-center">
      <h1>My App</h1>
      <ModeLiveIndicator variant="full" />
    </header>
  );
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-slate-400">
            For more details, check the{' '}
            <a href="/MODE_SYSTEM.md" className="text-blue-400 hover:text-blue-300">
              MODE_SYSTEM.md
            </a>
            {' '}documentation
          </p>
          <p className="text-slate-500 text-sm">
            Mode System • Tailwind CSS • React Hooks • Next.js
          </p>
        </div>
      </div>
    </div>
  );
}
