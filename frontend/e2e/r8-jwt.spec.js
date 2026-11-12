/* global Buffer */
// R8 — E2E real, ASSINATURAS EXCLUSIVAS da chave local descartável do test runner.
import { createHmac } from 'node:crypto';
import { test, expect, request as pwRequest } from '@playwright/test';

const API = 'http://127.0.0.1:18000';
const SECRET_ONLY_E2E = 'spec003-e2e-secret-not-for-production';
const PASSWORD = 'senha-e2e-123';

const payloadOf = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
const tokenFor = (claims) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', SECRET_ONLY_E2E).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
};

async function makeUser() {
  const email = 'r8jwt' + Date.now().toString(36) + Math.random().toString(36).slice(2) + '@e2e.test';
  const ctx = await pwRequest.newContext({ baseURL: API });
  const created = await ctx.post('/users/', { data: { email, name: 'jwt-tester', password: PASSWORD } });
  expect(created.status()).toBe(200);
  const tokens = await (await ctx.post('/auth/login', { data: { email, password: PASSWORD } })).json();
  const patch = await ctx.patch('/modules/me', {
    data: { loans_enabled: true, default_module: 'loans' },
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  });
  expect(patch.status()).toBe(200);
  await ctx.dispose();
  return { email, id: payloadOf(tokens.access_token).id };
}

async function login(page, email) {
  await page.goto('/');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Entrar' }) });
  await form.getByPlaceholder('teste@exemplo.com').fill(email);
  await form.getByPlaceholder('••••••••').first().fill(PASSWORD);
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/loans$/);
}

function expired(kind, identity) {
  return tokenFor({
    sub: identity.email, id: identity.id, token_type: kind,
    exp: Math.floor(Date.now() / 1000) - 60,
  });
}

test('R8-E2E: access realmente expirado → refresh único → módulo da R7 mantido', async ({ page }) => {
  const identity = await makeUser();
  await login(page, identity.email);
  await page.getByRole('button', { name: 'Cartões' }).click();
  await expect(page).toHaveURL(/\/home$/);
  const key = 'cobalance.activeModule:' + identity.email;
  expect(await page.evaluate((k) => sessionStorage.getItem(k), key)).toBe('cards');

  let refreshes = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/auth/refresh')) refreshes++;
  });
  await page.evaluate((value) => localStorage.setItem('token', value), expired('access', identity));
  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('tab', { name: 'Participantes' })).toBeVisible();
  await expect.poll(() => refreshes).toBe(1);
  const session = await page.evaluate(() => ({
    access: localStorage.getItem('token'), refresh: localStorage.getItem('refresh_token'),
  }));
  expect(payloadOf(session.access).token_type).toBe('access');
  expect(payloadOf(session.access).exp - payloadOf(session.access).iat).toBe(86400);
  expect(payloadOf(session.refresh).token_type).toBe('refresh');
  expect(payloadOf(session.refresh).exp - payloadOf(session.refresh).iat).toBe(30 * 86400);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), key)).toBe('cards');
});

test('R8-E2E: refresh expirado → login sem loop; sessão e seleção limpas', async ({ page }) => {
  const identity = await makeUser();
  await login(page, identity.email);
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem('token', access);
    localStorage.setItem('refresh_token', refresh);
    sessionStorage.setItem('cobalance.activeModule:preserve@example.test', 'cards');
    sessionStorage.setItem('unrelated.test.key', 'keep');
    localStorage.setItem('unrelated.local.key', 'keep');
  }, { access: expired('access', identity), refresh: expired('refresh', identity) });
  let refreshes = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/auth/refresh')) refreshes++;
  });
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  expect(refreshes).toBe(1);
  const state = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    refresh: localStorage.getItem('refresh_token'),
    selection: sessionStorage.getItem('cobalance.activeModule:preserve@example.test'),
    other: sessionStorage.getItem('unrelated.test.key'),
    otherLocal: localStorage.getItem('unrelated.local.key'),
  }));
  expect(state).toEqual({ token: null, refresh: null, selection: null, other: 'keep', otherLocal: 'keep' });
  await login(page, identity.email);
  await expect(page).toHaveURL(/\/loans$/);
});

test('R8-E2E: par JWT legado sem tipo exige novo login, não faz downgrade', async ({ page }) => {
  const identity = await makeUser();
  await login(page, identity.email);
  const legacy = tokenFor({
    sub: identity.email, id: identity.id, exp: Math.floor(Date.now() / 1000) + 3600,
  });
  await page.evaluate((value) => {
    localStorage.setItem('token', value);
    localStorage.setItem('refresh_token', value);
  }, legacy);
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await login(page, identity.email);
  await expect(page).toHaveURL(/\/loans$/);
});

test('R8-E2E-mobile @mobile: renovação transparente no ambiente Empréstimos', async ({ page }) => {
  const identity = await makeUser();
  await login(page, identity.email);
  await expect(page.getByTestId('env-badge')).toContainText('Empréstimos pessoais');
  await page.evaluate((value) => localStorage.setItem('token', value), expired('access', identity));
  const response = page.waitForResponse((r) => r.url().endsWith('/auth/refresh') && r.status() === 200);
  await page.reload();
  await response;
  await expect(page).toHaveURL(/\/loans$/);
  await expect(page.getByTestId('env-badge')).toBeVisible();
  expect(payloadOf(await page.evaluate(() => localStorage.getItem('token'))).token_type).toBe('access');
});
