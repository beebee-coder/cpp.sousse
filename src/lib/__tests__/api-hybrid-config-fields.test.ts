import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Contrôle de isDesktop (constante évaluée au chargement de api-hybrid).
const platformMock = vi.hoisted(() => ({ isDesktop: false }));
vi.mock('../platform', () => ({
  get isDesktop() { return platformMock.isDesktop; },
}));

// offline-repo : on évite tout accès FS réel.
const offlineMock = vi.hoisted(() => ({
  listOfflineTemplates: vi.fn(() => []),
  getOfflineTemplate: vi.fn(() => null),
  upsertOfflineTemplate: vi.fn(),
  deleteOfflineTemplate: vi.fn(() => true),
  normalizeTemplateOptions: vi.fn((o: any) => (Array.isArray(o) ? o : null)),
  ensureDefaultTemplates: vi.fn(),
  DEFAULT_OFFLINE_TEMPLATES: [],
}));
vi.mock('../procedures/offline-repo', () => offlineMock);

import { executeHybridRequest } from '../api-hybrid';

function makeLocalStorage(enabled = false) {
  const store: Record<string, string> = enabled ? { 'visionode-mode-local-only': '1' } : {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as Storage;
}

describe('executeHybridRequest — procedure-config-fields routing', () => {
  let lsBackup: any;
  beforeEach(() => {
    lsBackup = (globalThis as any).localStorage;
    platformMock.isDesktop = false;
    vi.clearAllMocks();
  });
  afterEach(() => {
    (globalThis as any).localStorage = lsBackup;
  });

  it('WEB + cloud online → fetch réel (Prisma)', async () => {
    (globalThis as any).localStorage = makeLocalStorage(false);
    platformMock.isDesktop = false;
    const webFetch = vi.fn(async () => ({ success: true, items: [{ id: 'cloud-1', name: 'Pression' }] }));
    const res: any = await executeHybridRequest('/api/procedure-config-fields', null, webFetch, { method: 'GET' });
    expect(webFetch).toHaveBeenCalledTimes(1);
    expect(res.items[0].id).toBe('cloud-1');
    expect(offlineMock.listOfflineTemplates).not.toHaveBeenCalled();
  });

  it('WEB local-only → interception offline (registre)', async () => {
    (globalThis as any).localStorage = makeLocalStorage(true);
    platformMock.isDesktop = false;
    offlineMock.listOfflineTemplates.mockReturnValue([{ id: 'off-1', name: 'Offline' }]);
    const webFetch = vi.fn(async () => ({ success: true, items: [] }));
    const res: any = await executeHybridRequest('/api/procedure-config-fields', null, webFetch, { method: 'GET' });
    expect(webFetch).not.toHaveBeenCalled();
    expect(offlineMock.ensureDefaultTemplates).toHaveBeenCalled();
    expect(res.items[0].id).toBe('off-1');
    expect(res.offline).toBe(true);
  });

  it('HYBRIDE online (desktop, pas localOnly) → fetch cloud', async () => {
    (globalThis as any).localStorage = makeLocalStorage(false);
    platformMock.isDesktop = true;
    const webFetch = vi.fn(async () => ({ success: true, items: [{ id: 'cloud-2', name: 'Temp' }] }));
    const res: any = await executeHybridRequest('/api/procedure-config-fields', null, webFetch, { method: 'GET' });
    expect(webFetch).toHaveBeenCalledTimes(1);
    expect(res.items[0].id).toBe('cloud-2');
  });

  it('DESKTOP offline (sans localOnly, échec cloud) → repli registre après tentative', async () => {
    (globalThis as any).localStorage = makeLocalStorage(false);
    platformMock.isDesktop = true;
    offlineMock.listOfflineTemplates.mockReturnValue([{ id: 'off-3', name: 'LocalFall' }]);
    const webFetch = vi.fn(async () => { throw new Error('NETWORK_DOWN'); });
    const res: any = await executeHybridRequest('/api/procedure-config-fields', null, webFetch, { method: 'GET' });
    // Le cloud est tenté une fois, puis repli offline.
    expect(webFetch).toHaveBeenCalledTimes(1);
    expect(offlineMock.listOfflineTemplates).toHaveBeenCalled();
    expect(res.items[0].id).toBe('off-3');
  });

  it('HYBRIDE offline (desktop, localOnly) → repli registre', async () => {
    (globalThis as any).localStorage = makeLocalStorage(true);
    platformMock.isDesktop = true;
    offlineMock.listOfflineTemplates.mockReturnValue([{ id: 'off-2', name: 'Local' }]);
    // En localOnly, le cloud n'est même pas tenté : on court-circuite.
    const webFetch = vi.fn(async () => { throw new Error('NETWORK_DOWN'); });
    const res: any = await executeHybridRequest('/api/procedure-config-fields', null, webFetch, { method: 'GET' });
    expect(webFetch).not.toHaveBeenCalled();
    expect(offlineMock.listOfflineTemplates).toHaveBeenCalled();
    expect(res.items[0].id).toBe('off-2');
  });

  it('route non interceptée → toujours fetch réel', async () => {
    (globalThis as any).localStorage = makeLocalStorage(true);
    platformMock.isDesktop = true;
    const webFetch = vi.fn(async () => ({ ok: true }));
    await executeHybridRequest('/api/unknown', null, webFetch, { method: 'GET' });
    expect(webFetch).toHaveBeenCalledTimes(1);
  });
});
