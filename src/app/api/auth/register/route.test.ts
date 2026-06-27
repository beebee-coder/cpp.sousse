import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const addPendingUserMock = vi.fn();

vi.mock('@/lib/auth-users', () => ({
  addPendingUser: addPendingUserMock,
}));

import { POST } from './route';

describe('register route', () => {
  beforeEach(() => {
    addPendingUserMock.mockReset();
  });

  it('returns 409 when the requested user already exists', async () => {
    addPendingUserMock.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'Ada', lastName: 'Lovelace', password: 'secret' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false });
  });
});
