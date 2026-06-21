export const dynamic = 'force-static';

import { createHybridRoute } from '@/lib/api-hybrid';
import { runChromaDemo } from '@/lib/chroma-example';

export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_DEMO_GET',
  webHandler: async () => {
    const results = await runChromaDemo();
    return { success: true, ...results };
  },
  desktopFallback: async () => {
    return { success: true, demo: 'simulated' };
  }
});
