'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeBadge } from '@/components/ModeIndicator';

export default function DemoIndex() {
  const demos = [
    {
      href: '/demo/modes',
      title: '🎭 Mode System',
      description: 'Complete mode showcase with current status and detailed info',
      icon: '🎭',
    },
    {
      href: '/demo/examples',
      title: '📚 Integration Examples',
      description: 'Copy-paste ready code examples for implementing mode system',
      icon: '📚',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <ModeBadge />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Mode System Demos
          </h1>
          <p className="text-slate-400 text-lg">
            Three modes • Unique UI • Real-time detection
          </p>
        </div>

        {/* Demo Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {demos.map((demo) => (
            <Link key={demo.href} href={demo.href}>
              <Card className="bg-slate-900/50 border-slate-700 hover:border-slate-600 hover:shadow-lg hover:shadow-blue-500/20 transition-all cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">{demo.icon}</span>
                        {demo.title}
                      </CardTitle>
                    </div>
                  </div>
                  <CardDescription>{demo.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-400">
                    Click to explore →
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Start */}
        <Card className="bg-slate-900/50 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle>🚀 Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div>
              <h4 className="font-semibold text-white mb-2">1. Current Mode Badge</h4>
              <code className="bg-slate-950 p-2 rounded block text-xs">
                &lt;ModeBadge /&gt;
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">2. Get Mode Info</h4>
              <code className="bg-slate-950 p-2 rounded block text-xs">
                const {'{mode, isOnline}'} = useAppMode()
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">3. Add to Header</h4>
              <code className="bg-slate-950 p-2 rounded block text-xs">
                &lt;ModeLiveIndicator variant="full" /&gt;
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400">☁️ Web Mode</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Cloud-based experience with full sync and cloud features
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400">🔗 Hybrid Mode</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Local app with cloud sync and offline capability
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-amber-400">⚡ Offline Mode</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Fully autonomous, no connection needed, ultra-fast
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Mode System v1.0 • Tailwind CSS • Real-time Detection</p>
          <p className="mt-2">
            Documentation: <a href="/MODE_SYSTEM.md" className="text-blue-400 hover:text-blue-300">MODE_SYSTEM.md</a>
          </p>
        </div>
      </div>
    </div>
  );
}
