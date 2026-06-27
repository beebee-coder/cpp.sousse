
import { createHybridRoute } from '@/lib/api-route-creator';
import { runChromaDemo } from '@/lib/chroma-example';

export const GET = createHybridRoute<any, any>({
  name: 'VECTOR_DEMO_GET',
  webHandler: async () => {
    try {
      const results = await runChromaDemo();
      return { success: true, ...results };
    } catch (e: any) {
      return { success: false, error: 'DEMO_FAILED', details: e.message };
    }
  }
});
