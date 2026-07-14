'use client';

import dynamic from 'next/dynamic';

const AmbientBackground = dynamic(() => import('@/components/three/AmbientBackground').then(mod => ({ default: mod.AmbientBackground })), { ssr: false });

export function LazyAmbientBackground() {
  return <AmbientBackground />;
}
