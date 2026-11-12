/* SPEC004: browser real + API FastAPI + banco e2e_test tmpfs. */
import { test, expect, request as pwRequest } from '@playwright/test';

const API = 'http://127.0.0.1:18000';
const PASSWORD = 'senha-e2e-123';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
const month = TODAY.slice(0, 7);
const isoToBr = (s) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
const addDays = (iso, n) => {
  const dt = new Date(iso + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
let number = 0;
const key = (s) => s + '-' + Date.now() + '-' + (++number);

async function makeUser(label) {
  const email = key('s4' + label).replace(/[^a-zA-Z0-9-]/g, '') + '@e2e.test';
  const ctx = await pwRequest.newContext({ baseURL: API });
  const reg = await ctx.post('/users/', { data: { email, name: 'spec004', password: PASSWORD } });
  expect(reg.status()).toBe(200);
  const auth = await (await ctx.post('/auth/login', { data: { email, password: PASSWORD } })).json();
  const headers = { Authorization: 'Bearer ' + auth.access_token };
  const call = async (method, url, data) => {
    const r = await ctx.fetch(url, { method, headers, data });
    return { status: r.status(), body: await r.json() };
  };
  expect((await call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'loans' })).status).toBe(200);
  return { email, call, ctx };
}
async function login(page, email) {
  await page.goto('/');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Entrar' }) });
  await form.getByPlaceholder('teste@exemplo.com').fill(email);
  await form.getByPlaceholder('••••••••').first().fill(PASSWORD);
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/loans$/);
}
const TERMS = {
  principal: '1000.00', interest_method: 'fixed_addon', rate: '0',
  installment_count: 3, frequency: 'monthly',
  start_on: TODAY, first_due_on: addDays(TODAY, 30),
};
async function createActive(u, bid) {
  const created = await u.call('POST', '/loans/contracts', {
    ...TERMS, borrower_id: bid, idempotency_key: key('contract'),
  });
  expect(created.status).toBe(201);
  const funded = await u.call('POST', '/loans/contracts/' + created.body.id + '/fund', {
    funded_on: TODAY, idempotency_key: key('fund'),
  });
  expect(funded.status).toBe(200);
  return funded.body;
}

test('SPEC004-E2E-A: anular erro de envio preserva histórico e não simula recebimento', async ({ page }) => {
  const u = await makeUser('void');
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Cadastro equivocado' })).body.id;
  const loan = await createActive(u, bid);
  expect((await u.call('GET', '/loans/reports/monthly?month=' + month)).body.realized.disbursed).toBe('1000.00');
  await login(page, u.email);
  await page.getByRole('button', { name: 'Cadastro equivocado' }).click();
  const card = page.getByTestId('loan-' + loan.id);
  await card.getByRole('button', { name: 'Excluir empréstimo #' + loan.id }).click();
  const dialog = card.getByRole('group', { name: 'Anular registro do empréstimo ' + loan.id });
  await expect(dialog).toContainText('Esta ação não registra pagamento nem devolução');
  await expect(dialog).toContainText('Cadastro equivocado');
  await expect(dialog.getByRole('button', { name: 'Confirmar anulação' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Voltar sem anular' }).click();
  expect((await u.call('GET', '/loans/contracts/' + loan.id)).body.status).toBe('ACTIVE');
  await card.getByRole('button', { name: 'Excluir empréstimo #' + loan.id }).click();
  const second = card.getByRole('group', { name: 'Anular registro do empréstimo ' + loan.id });
  await second.getByLabel('Motivo da anulação').fill('Registro duplicado');
  await second.getByLabel('Confirmo que desejo anular este registro').check();
  await expect(second.getByRole('button', { name: 'Confirmar anulação' })).toBeDisabled();
  await second.getByLabel(/Confirme que o dinheiro não foi realmente transferido/).check();
  await second.getByRole('button', { name: 'Confirmar anulação' }).click();
  await expect(page.getByRole('status')).toContainText('Registro anulado sem pagamento ou devolução');
  await expect(page.getByTestId('loan-' + loan.id)).toHaveCount(0);
  expect((await u.call('GET', '/loans/contracts/' + loan.id)).body.status).toBe('VOIDED');
  expect((await u.call('GET', '/loans/reports/monthly?month=' + month)).body.realized).toMatchObject({
    disbursed: '0.00', received_total: '0.00', net_cashflow: '0.00', receipts_count: 0,
  });
  await page.getByRole('button', { name: 'Mostrar anulados' }).click();
  await expect(page.getByTestId('loan-' + loan.id)).toContainText('Anulado — registro desconsiderado');
  await expect(page.getByTestId('loan-' + loan.id)).toContainText('Registro duplicado');
  await expect(page.getByTestId('loan-' + loan.id).getByRole('checkbox')).toHaveCount(0);
  expect((await u.call('GET', '/loans/receipts')).body).toHaveLength(0);
  await u.ctx.dispose();
});

test('SPEC004-E2E-B: Sem juros 3x e data brasileira → payload ISO, simular/funding/receber', async ({ page }) => {
  const u = await makeUser('free');
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Pessoa sem juros' })).body.id;
  await login(page, u.email);
  await page.getByRole('tab', { name: 'Novo empréstimo' }).click();
  await page.getByLabel('Tomador').selectOption(String(bid));
  await page.getByLabel('Valor emprestado (R$)').fill('1.000,00');
  await page.getByRole('button', { name: 'Sem juros' }).click();
  await expect(page.getByLabel('Taxa')).toHaveValue('0');
  await page.getByLabel('Parcelas').fill('3');
  await page.getByLabel('Data de início').fill(isoToBr(TODAY));
  const firstDue = addDays(TODAY, 30);
  await page.getByLabel('Primeiro vencimento').fill(isoToBr(firstDue));
  const sent = page.waitForRequest((r) => r.url().endsWith('/loans/simulate'));
  await page.getByRole('button', { name: 'Simular' }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    rate: '0', interest_method: 'fixed_addon', principal: '1000.00',
    installment_count: 3, start_on: TODAY, first_due_on: firstDue,
  });
  await expect(page.getByTestId('sim-total')).toHaveText(['R$ 333,34', 'R$ 333,33', 'R$ 333,33']);
  await expect(page.getByTestId('sim-interest')).toHaveText('R$ 0,00');
  await expect(page.getByTestId('sim-grand')).toHaveText('R$ 1.000,00');
  await page.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await page.getByRole('button', { name: 'Confirmar envio de R$ 1.000,00' }).click();
  await expect(page.getByRole('status')).toContainText('Envio confirmado');
  await page.getByRole('button', { name: 'Abrir ficha do tomador' }).click();
  await expect(page.getByTestId('open-total')).toHaveText('R$ 1.000,00');
  const row = page.locator('[data-testid^="inst-"]').first();
  await row.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Registrar recebimento' }).click();
  await page.getByRole('button', { name: 'Confirmar recebimento de R$ 333,34' }).click();
  await expect(page.getByTestId('open-total')).toHaveText('R$ 666,66');
  const report = (await u.call('GET', '/loans/reports/monthly?month=' + month)).body;
  expect(report.realized.interest_received).toBe('0.00');
  await u.ctx.dispose();
});

test('SPEC004-E2E-C: datas manuais exigem calendário real e inteiros estritos', async ({ page }) => {
  const u = await makeUser('dates');
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Datas manuais' })).body.id;
  await login(page, u.email);
  await page.getByRole('tab', { name: 'Novo empréstimo' }).click();
  await page.getByLabel('Tomador').selectOption(String(bid));
  await page.getByLabel('Valor emprestado (R$)').fill('1000');
  await page.getByLabel('Parcelas').fill('3');
  await page.getByLabel('Taxa').fill('0%');
  await page.getByLabel('Data de início').fill(isoToBr(TODAY));
  await page.getByLabel('Frequência').selectOption('manual');
  await page.getByLabel('Parcela 1').fill('31/02/2027');
  await page.getByLabel('Parcela 2').fill('10/03/2027');
  await page.getByLabel('Parcela 3').fill('10/04/2027');
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page.getByRole('alert')).toContainText('Parcela 1: data inválida');
  await page.getByLabel('Parcela 1').fill('10/02/2027');
  const req = page.waitForRequest((r) => r.url().endsWith('/loans/simulate'));
  await page.getByRole('button', { name: 'Simular' }).click();
  expect((await req).postDataJSON()).toMatchObject({
    rate: '0', frequency: 'manual', manual_dates: ['2027-02-10', '2027-03-10', '2027-04-10'],
  });
  await expect(page.getByTestId('sim-grand')).toHaveText('R$ 1.000,00');
  await page.getByLabel('Parcelas').fill('3abc');
  await expect(page.getByLabel('Parcelas')).toHaveValue('3');
  await expect(page.getByRole('alert')).toContainText('Parcelas aceita apenas algarismos');
  await u.ctx.dispose();
});

test('SPEC004-E2E-mobile @mobile: pastilhas têm alvo completo e 320px sem overflow', async ({ page }, testInfo) => {
  const u = await makeUser('chips');
  const longName = 'Maria Helena com um nome extraordinariamente extenso para teste no celular';
  await u.call('POST', '/loans/borrowers', { name: longName });
  await u.call('POST', '/loans/borrowers', { name: 'Ana' });
  await login(page, u.email);
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 750 });
    const pill = page.getByRole('button', { name: longName });
    await expect(pill).toHaveAttribute('aria-pressed', 'false');
    await expect(pill).toBeVisible();
    const rect = await pill.boundingBox();
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.width).toBeGreaterThan(80);
    if (testInfo.project.name === 'mobile-chromium') await pill.tap();
    else await pill.click();
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Ficha de ' + longName)).toBeVisible();
    if (testInfo.project.name === 'mobile-chromium') await page.getByRole('button', { name: 'Ana' }).tap();
    else await page.getByRole('button', { name: 'Ana' }).click();
    await expect(page.getByLabel('Ficha de Ana')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
  await u.ctx.dispose();
});

test('SPEC004-E2E-D: cobrança existente bloqueia anulação com 409 sem efeito parcial', async ({ page }) => {
  const u = await makeUser('blocked');
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Movimento protegido' })).body.id;
  const loan = await createActive(u, bid);
  const pix = await u.call('POST', '/loans/pix-accounts', {
    label: 'Padrão', key: 'spec004@example.test', holder_name: 'Titular', city: 'Fortaleza',
  });
  expect(pix.status).toBe(201);
  const charge = await u.call('POST', '/loans/charges', {
    borrower_id: bid, installment_ids: [loan.installments[0].id],
  });
  expect(charge.status).toBe(201);
  await login(page, u.email);
  await page.getByRole('button', { name: 'Movimento protegido' }).click();
  const card = page.getByTestId('loan-' + loan.id);
  await card.getByRole('button', { name: 'Excluir empréstimo #' + loan.id }).click();
  const dialog = card.getByRole('group', { name: 'Anular registro do empréstimo ' + loan.id });
  await dialog.getByLabel('Motivo da anulação').fill('Registro equivocado');
  await dialog.getByLabel('Confirmo que desejo anular este registro').check();
  await dialog.getByLabel(/Confirme que o dinheiro não foi realmente transferido/).check();
  const response = page.waitForResponse((r) => r.url().endsWith('/loans/contracts/' + loan.id + '/void'));
  await dialog.getByRole('button', { name: 'Confirmar anulação' }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('Contrato com movimentos financeiros');
  expect((await u.call('GET', '/loans/contracts/' + loan.id)).body.status).toBe('ACTIVE');
  expect((await u.call('GET', '/loans/charges')).body).toHaveLength(1);
  await u.ctx.dispose();
});
