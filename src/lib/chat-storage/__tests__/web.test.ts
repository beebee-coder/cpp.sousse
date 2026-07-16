import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webStorage } from '../web';

const STORAGE_KEY_PREFIX = 'visionode_chat_history';

function createLocalStorageMock() {
  const store: Record<string, string> = {};
  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    store,
  };
  (globalThis as any).localStorage = mock;
  (globalThis as any).window = { localStorage: mock };
  return mock;
}

describe('ChatStorage (web)', () => {
  let mockStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockStorage = createLocalStorageMock();
  });

  it('saves and loads history with userId and conversationId scoping', async () => {
    const messages = [
      { role: 'user' as const, content: 'hello', timestamp: 1 },
      { role: 'model' as const, content: 'world', timestamp: 2 },
    ];
    await webStorage.saveHistory(messages, 'user-1', 'conv-1');
    const loaded = await webStorage.loadHistory('user-1', 'conv-1');
    expect(loaded).toEqual(messages);
    expect(mockStorage.setItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}_user-1_conv-1`, expect.any(String));
  });

  it('isolates conversations by userId and conversationId', async () => {
    await webStorage.saveHistory([{ role: 'user', content: 'a', timestamp: 1 }], 'user-1', 'conv-1');
    await webStorage.saveHistory([{ role: 'user', content: 'b', timestamp: 2 }], 'user-1', 'conv-2');
    await webStorage.saveHistory([{ role: 'user', content: 'c', timestamp: 3 }], 'user-2', 'conv-1');

    const c1 = await webStorage.loadHistory('user-1', 'conv-1');
    const c2 = await webStorage.loadHistory('user-1', 'conv-2');
    const c3 = await webStorage.loadHistory('user-2', 'conv-1');

    expect(c1).toHaveLength(1);
    expect(c1[0].content).toBe('a');
    expect(c2).toHaveLength(1);
    expect(c2[0].content).toBe('b');
    expect(c3).toHaveLength(1);
    expect(c3[0].content).toBe('c');
  });

  it('caps history at 100 messages', async () => {
    const messages = Array.from({ length: 150 }, (_, i) => ({ role: 'user' as const, content: `msg-${i}`, timestamp: i }));
    await webStorage.saveHistory(messages, 'user-1', 'conv-1');
    const loaded = await webStorage.loadHistory('user-1', 'conv-1');
    expect(loaded).toHaveLength(100);
    expect(loaded[0].content).toBe('msg-50');
    expect(loaded[99].content).toBe('msg-149');
  });

  it('recovers from corrupt primary key using tmp fallback', async () => {
    const key = `${STORAGE_KEY_PREFIX}_user-1_conv-1`;
    const tmpKey = `${key}_tmp`;
    mockStorage.store[key] = 'not-json';
    mockStorage.store[tmpKey] = JSON.stringify([{ role: 'user', content: 'recovered', timestamp: 1 }]);

    const loaded = await webStorage.loadHistory('user-1', 'conv-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe('recovered');
  });

  it('returns empty array when both keys are corrupt', async () => {
    const key = `${STORAGE_KEY_PREFIX}_user-1_conv-1`;
    mockStorage.store[key] = 'not-json';

    const loaded = await webStorage.loadHistory('user-1', 'conv-1');
    expect(loaded).toEqual([]);
  });

  it('clears both primary and tmp keys', async () => {
    const key = `${STORAGE_KEY_PREFIX}_user-1_conv-1`;
    const tmpKey = `${key}_tmp`;
    mockStorage.store[key] = 'data';
    mockStorage.store[tmpKey] = 'tmp-data';

    await webStorage.clearHistory('user-1', 'conv-1');
    expect(mockStorage.removeItem).toHaveBeenCalledWith(key);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(tmpKey);
  });
});
