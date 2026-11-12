import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import { waitFor } from '@testing-library/react';
import api from './api';

const originalAdapter = api.defaults.adapter;
const originalBaseURL = api.defaults.baseURL;
const ok = (config, data = { ok: true }) => ({
  data, status: 200, statusText: 'OK', headers: {}, config,
});
const unauthorized = (config) => new AxiosError(
  'Unauthorized', 'ERR_BAD_RESPONSE', config, null,
  { data: { detail: 'Token inválido' }, status: 401, statusText: 'Unauthorized', headers: {}, config },
);

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('token', 'stale-access');
  localStorage.setItem('refresh_token', 'long-refresh');
  api.defaults.baseURL = 'http://127.0.0.1:18000';
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  api.defaults.baseURL = originalBaseURL;
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('SPEC003-R8 — interceptor de renovação', () => {
  it('401 access expirado → refresh → retry com novo access (uma só vez)', async () => {
    const adapter = vi.fn(async (config) => {
      if (config.headers.Authorization !== 'Bearer renewed-access') throw unauthorized(config);
      return ok(config);
    });
    api.defaults.adapter = adapter;
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'renewed-access' } });
    const res = await api.get('/participants/self');
    expect(res.data.ok).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toContain('/auth/refresh');
    expect(post.mock.calls[0][1]).toEqual({ refresh_token: 'long-refresh' });
    expect(localStorage.getItem('token')).toBe('renewed-access');
    expect(localStorage.getItem('refresh_token')).toBe('long-refresh');
  });

  it('401 do retry não causa loop nem segunda tentativa de refresh', async () => {
    const adapter = vi.fn(async (config) => { throw unauthorized(config); });
    api.defaults.adapter = adapter;
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'renewed-access' } });
    await expect(api.get('/loans/borrowers')).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('requisições paralelas compartilham um refresh único', async () => {
    const adapter = vi.fn(async (config) => {
      if (config.headers.Authorization !== 'Bearer renewed-access') throw unauthorized(config);
      return ok(config);
    });
    api.defaults.adapter = adapter;
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const post = vi.spyOn(axios, 'post').mockReturnValue(pending);
    const responses = Promise.all([api.get('/participants/self'), api.get('/modules/me'), api.get('/loans/borrowers')]);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    release({ data: { access_token: 'renewed-access' } });
    expect((await responses).map((r) => r.status)).toEqual([200, 200, 200]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('refresh_token')).toBe('long-refresh');
  });

  it('401 de request com token antigo usa token já renovado, sem segundo refresh', async () => {
    api.defaults.adapter = vi.fn(async (config) => {
      if (config.headers.Authorization === 'Bearer stale-access') {
        localStorage.setItem('token', 'renewed-by-other-request');
        throw unauthorized(config);
      }
      expect(config.headers.Authorization).toBe('Bearer renewed-by-other-request');
      return ok(config);
    });
    const post = vi.spyOn(axios, 'post');
    const result = await api.get('/auth/me');
    expect(result.status).toBe(200);
    expect(post).not.toHaveBeenCalled();
  });

  it('refresh inválido limpa só credenciais e seleções temporárias, preservando outros dados', async () => {
    api.defaults.adapter = vi.fn(async (config) => { throw unauthorized(config); });
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Expired refresh', 'ERR_BAD_RESPONSE', {}, null, {
      data: { detail: 'Token inválido' }, status: 401, statusText: 'Unauthorized', headers: {}, config: {},
    }));
    sessionStorage.setItem('cobalance.activeModule:a@example.test', 'loans');
    sessionStorage.setItem('unrelated.session.data', 'keep');
    localStorage.setItem('unrelated.local.data', 'keep');
    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(sessionStorage.getItem('cobalance.activeModule:a@example.test')).toBeNull();
    expect(sessionStorage.getItem('unrelated.session.data')).toBe('keep');
    expect(localStorage.getItem('unrelated.local.data')).toBe('keep');
  });

  it('401 de login ou refresh não dispara outra renovação', async () => {
    api.defaults.adapter = vi.fn(async (config) => { throw unauthorized(config); });
    const post = vi.spyOn(axios, 'post');
    await expect(api.post('/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({ response: { status: 401 } });
    await expect(api.post('/auth/refresh', { refresh_token: 'invalid' })).rejects.toMatchObject({ response: { status: 401 } });
    expect(post).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBe('stale-access');
  });

  it('logout/troca de conta durante refresh não reintroduz token nem apaga a nova conta', async () => {
    api.defaults.adapter = vi.fn(async (config) => { throw unauthorized(config); });
    let release;
    vi.spyOn(axios, 'post').mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const attempt = api.get('/modules/me');
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    localStorage.setItem('token', 'access-user-b');
    localStorage.setItem('refresh_token', 'refresh-user-b');
    sessionStorage.setItem('cobalance.activeModule:b@example.test', 'cards');
    release({ data: { access_token: 'late-access-user-a' } });
    await expect(attempt).rejects.toBeTruthy();
    expect(localStorage.getItem('token')).toBe('access-user-b');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-user-b');
    expect(sessionStorage.getItem('cobalance.activeModule:b@example.test')).toBe('cards');
  });
});

it('R8: falha transitória 503 ao renovar NÃO descarta refresh ainda válido', async () => {
  api.defaults.adapter = vi.fn(async (config) => { throw unauthorized(config); });
  vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError(
    'Service Unavailable', 'ERR_BAD_RESPONSE', {}, null,
    { data: {}, status: 503, statusText: 'Unavailable', headers: {}, config: {} },
  ));
  sessionStorage.setItem('cobalance.activeModule:a@example.test', 'loans');
  await expect(api.get('/auth/me')).rejects.toMatchObject({ response: { status: 503 } });
  expect(localStorage.getItem('token')).toBe('stale-access');
  expect(localStorage.getItem('refresh_token')).toBe('long-refresh');
  expect(sessionStorage.getItem('cobalance.activeModule:a@example.test')).toBe('loans');
});
