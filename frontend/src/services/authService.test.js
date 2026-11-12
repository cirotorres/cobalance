import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
import api from './api';
import { refreshToken } from './authService';

beforeEach(() => vi.clearAllMocks());

describe('SPEC003-R8 — função auxiliar de renovação', () => {
  it('aguarda response HTTP e entrega somente payload de access', async () => {
    api.post.mockResolvedValue({ data: { access_token: 'new-access' } });
    await expect(refreshToken('a-valid-refresh')).resolves.toEqual({ access_token: 'new-access' });
    expect(api.post).toHaveBeenCalledWith('/auth/refresh', { refresh_token: 'a-valid-refresh' });
  });

  it('falha controlada sem vazar token em console', async () => {
    api.post.mockRejectedValue(new Error('Network unavailable'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(refreshToken('a-sensitive-refresh')).resolves.toBe(false);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
