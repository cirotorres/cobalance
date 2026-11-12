/* global Buffer */
// SPEC003 — E2E em browser real (Chromium) + FastAPI real + PostgreSQL descartável.
import { test, expect, request as pwRequest } from '@playwright/test';

const API = 'http://127.0.0.1:18000';
const PASSWORD = 'senha-e2e-123';
let seq = 0;
const uniq = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}@e2e.test`;

function todayFortaleza() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
}
const brDate = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const TODAY = todayFortaleza();

function crc16(str) {
  let crc = 0xffff;
  for (const ch of Buffer.from(str, 'utf8')) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

async function apiUser(email) {
  const ctx = await pwRequest.newContext({ baseURL: API });
  const r = await ctx.post('/users/', { data: { email, name: email.split('@')[0], password: PASSWORD } });
  expect(r.status()).toBe(200);
  const login = await (await ctx.post('/auth/login', { data: { email, password: PASSWORD } })).json();
  const headers = { Authorization: `Bearer ${login.access_token}` };
  const call = async (method, url, data) => {
    const res = await ctx.fetch(url, { method, data, headers });
    let body = null;
    try { body = await res.json(); } catch { /* vazio */ }
    return { status: res.status(), body };
  };
  return { email, call, tokens: login };
}

async function uiLogin(page, email) {
  await page.goto('/');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Entrar' }) });
  await form.getByPlaceholder('teste@exemplo.com').fill(email);
  await form.getByPlaceholder('••••••••').first().fill(PASSWORD);
  await form.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/(home|loans)/);
}

async function seedFundedLoan(u, borrowerId, terms, fundedOn = TODAY) {
  const c = await u.call('POST', '/loans/contracts', { borrower_id: borrowerId, idempotency_key: `seed-${Math.random()}`, ...terms });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const f = await u.call('POST', `/loans/contracts/${c.body.id}/fund`, { funded_on: fundedOn, idempotency_key: `seedf-${Math.random()}` });
  expect(f.status, JSON.stringify(f.body)).toBe(200);
  return f.body;
}

const cents = (s) => Math.round(Number(s.replace('.', '')));

// ---------------------------------------------------------------------------------------------
test('E2E-1: habilita Empréstimos, cadastra Cleide, simula Modelo A 3000/3x/5%, confirma envio; Cartões intacto', async ({ page }) => {
  const email = uniq('a1');
  await apiUser(email);
  await uiLogin(page, email);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('tab', { name: 'Lançamentos' })).toBeVisible();
  await page.getByRole('button', { name: 'Ativar Empréstimos' }).click();
  await expect(page).toHaveURL(/\/loans$/);
  await expect(page.getByTestId('env-badge')).toContainText('Empréstimos pessoais');

  await page.getByLabel('Nome do tomador').fill('Cleide');
  await page.getByRole('button', { name: 'Cadastrar tomador' }).click();
  await expect(page.getByRole('heading', { name: 'Cleide' })).toBeVisible();

  await page.getByRole('tab', { name: 'Novo empréstimo' }).click();
  await page.getByLabel('Tomador').selectOption({ label: 'Cleide' });
  await page.getByLabel('Valor emprestado (R$)').fill('3.000,00');
  await page.getByLabel('Taxa').fill('5');
  await page.getByLabel('Parcelas').fill('3');
  await page.getByLabel('Primeiro vencimento').fill(brDate(addDays(TODAY, 30)));
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page.getByTestId('sim-total')).toHaveText(['R$ 1.150,00', 'R$ 1.150,00', 'R$ 1.150,00']);
  await expect(page.getByTestId('sim-interest')).toHaveText('R$ 450,00');
  await expect(page.getByTestId('sim-grand')).toHaveText('R$ 3.450,00');
  await page.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await page.getByRole('button', { name: 'Confirmar envio de R$ 3.000,00' }).click();
  await expect(page.getByRole('status')).toContainText('Envio confirmado');
  await page.getByRole('button', { name: 'Abrir ficha do tomador' }).click();
  await expect(page.getByTestId('open-total')).toHaveText('R$ 3.450,00');
  await expect(page.locator('[data-testid^="inst-"]')).toHaveCount(3);

  await page.getByRole('tab', { name: 'Balanço' }).click();
  await expect(page.getByTestId('dash-total')).toHaveText('R$ 3.450,00');
  await expect(page.getByTestId('dash-principal')).toHaveText('R$ 3.000,00');
  await expect(page.getByTestId('rep-disbursed')).toHaveText('R$ 3.000,00');
  await expect(page.getByTestId('rep-net')).toHaveText('-R$ 3.000,00');

  // Cartões segue intacto e isolado
  await page.getByRole('button', { name: 'Cartões' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('tab', { name: 'Participantes' }).click();
  await expect(page.getByRole('heading', { name: 'Participantes' })).toBeVisible();
  await expect(page.getByText('Cleide')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
test('E2E-2: segundo empréstimo, cobrança Pix padrão com QR/CRC válido, recebimento consolidado 1 receipt/2 allocations', async ({ page }) => {
  const email = uniq('a2');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Cleide' })).body.id;
  await seedFundedLoan(u, bid, { principal: '3000.00', interest_method: 'fixed_addon', rate: '5', installment_count: 3,
    frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30) });

  await uiLogin(page, email);
  await page.goto('/loans');
  await page.getByRole('tab', { name: 'Configurações' }).click();
  await page.getByLabel('Apelido').fill('Nubank');
  await page.getByLabel('Chave Pix').fill('cobranca@e2e.test');
  await page.getByLabel('Nome do recebedor').fill('Titular E2E');
  await page.getByLabel('Cidade do recebedor').fill('Fortaleza');
  await page.getByRole('button', { name: 'Adicionar conta Pix' }).click();
  await expect(page.getByText('Padrão', { exact: true })).toBeVisible();

  // segundo empréstimo pela UI (Lívia-like: 1000/4x/5%)
  await page.getByRole('tab', { name: 'Novo empréstimo' }).click();
  await page.getByLabel('Tomador').selectOption({ label: 'Cleide' });
  await page.getByLabel('Valor emprestado (R$)').fill('1000');
  await page.getByLabel('Parcelas').fill('4');
  await page.getByLabel('Primeiro vencimento').fill(brDate(addDays(TODAY, 20)));
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page.getByTestId('sim-total')).toHaveText(Array(4).fill('R$ 300,00'));
  await page.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await page.getByRole('button', { name: 'Confirmar envio de R$ 1.000,00' }).click();
  await page.getByRole('button', { name: 'Abrir ficha do tomador' }).click();

  const loans = (await u.call('GET', '/loans/contracts')).body.sort((x, y) => x.id - y.id);
  const [l1, l2] = loans;
  await page.getByLabel(`Selecionar parcela 1 do empréstimo ${l1.id}`).check();
  await page.getByLabel(`Selecionar parcela 1 do empréstimo ${l2.id}`).check();
  await expect(page.getByText(/Selecionadas: 2 · Total R\$ 1\.450,00/)).toBeVisible();

  await page.getByRole('button', { name: 'Gerar cobrança Pix' }).click();
  await expect(page.getByLabel('Conta Pix de destino')).toContainText('Nubank (padrão)');
  await page.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
  await expect(page.getByTestId('pix-qr')).toBeVisible();
  const brcode = await page.getByTestId('pix-brcode').inputValue();
  expect(brcode.startsWith('000201')).toBe(true);
  expect(brcode).toContain('br.gov.bcb.pix');
  expect(brcode).toContain('54071450.00');
  expect(crc16(brcode.slice(0, -4))).toBe(brcode.slice(-4));
  await expect(page.getByRole('note')).toContainText('não');
  // gerar cobrança não quita
  expect((await u.call('GET', '/loans/receipts')).body).toEqual([]);

  await page.getByRole('button', { name: 'Registrar recebimento' }).click();
  await expect(page.getByLabel('Valor parcial parcela 1 empréstimo ' + l1.id)).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar recebimento de R$ 1.450,00' }).click();
  await expect(page.getByRole('status')).toContainText('2 parcela(s)');
  await expect(page.getByTestId(`inst-${l1.id}-1`)).toContainText('Paga');
  await expect(page.getByTestId(`inst-${l2.id}-1`)).toContainText('Paga');

  const receipts = (await u.call('GET', '/loans/receipts')).body;
  expect(receipts).toHaveLength(1);
  expect(receipts[0].allocations).toHaveLength(2);
  expect(receipts[0].received_on).toBe(TODAY);
  const rep = (await u.call('GET', `/loans/reports/monthly?month=${TODAY.slice(0, 7)}`)).body;
  expect(rep.realized).toMatchObject({ received_total: '1450.00', principal_recovered: '1250.00', interest_received: '200.00', receipts_count: 1 });
  await page.getByRole('tab', { name: 'Balanço' }).click();
  await expect(page.getByTestId('rep-received')).toHaveText('R$ 1.450,00');
  await expect(page.getByTestId('rep-interest')).toHaveText('R$ 200,00');
});

// ---------------------------------------------------------------------------------------------
test('E2E-3: usuário B não acessa tomador/contrato/Pix/cobrança/recibo de A (API e UI)', async ({ page }) => {
  const a = await apiUser(uniq('a3'));
  await a.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await a.call('POST', '/loans/borrowers', { name: 'Cleide Sigilosa' })).body.id;
  const pix = (await a.call('POST', '/loans/pix-accounts', { label: 'A', key: 'a@e2e.test', holder_name: 'A', city: 'Fortaleza' })).body;
  const loan = await seedFundedLoan(a, bid, { principal: '3000.00', interest_method: 'fixed_addon', rate: '5', installment_count: 3,
    frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30) });
  const inst = loan.installments[0];
  const charge = (await a.call('POST', '/loans/charges', { borrower_id: bid, installment_ids: [inst.id] })).body;
  const receipt = (await a.call('POST', '/loans/receipts', { borrower_id: bid, received_on: TODAY, amount: '1150.00',
    items: [{ installment_id: inst.id }], idempotency_key: 'e2e3-receipt-1' })).body;

  const bEmail = uniq('b3');
  const b = await apiUser(bEmail);
  expect((await b.call('GET', `/loans/borrowers/${bid}`)).status).toBe(403); // módulo inativo para B
  await b.call('PATCH', '/modules/me', { loans_enabled: true });
  const probes = [
    ['GET', `/loans/borrowers/${bid}`], ['PATCH', `/loans/borrowers/${bid}`, { name: 'x' }], ['GET', `/loans/borrowers/${bid}/statement`],
    ['GET', `/loans/contracts/${loan.id}`], ['POST', `/loans/contracts/${loan.id}/cancel`],
    ['PATCH', `/loans/pix-accounts/${pix.id}`, { label: 'x' }], ['POST', `/loans/pix-accounts/${pix.id}/default`],
    ['GET', `/loans/charges/${charge.id}`], ['POST', `/loans/charges/${charge.id}/shared`],
    ['GET', `/loans/receipts/${receipt.id}`], ['POST', `/loans/receipts/${receipt.id}/reverse`, { reason: 'invasão' }],
    ['POST', `/loans/installments/${inst.id}/adjustments`, { amount: '1.00', reason: 'xxx', idempotency_key: 'e2e3-adj-1' }],
  ];
  for (const [m, url, data] of probes) {
    const r = await b.call(m, url, data);
    expect(r.status, `${m} ${url}`).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain('Cleide');
  }
  for (const url of ['/loans/borrowers', '/loans/contracts', '/loans/receipts', '/loans/charges', '/loans/pix-accounts']) {
    expect((await b.call('GET', url)).body, url).toEqual([]);
  }
  // A continua íntegro
  expect((await a.call('GET', `/loans/receipts/${receipt.id}`)).body.reversed).toBe(false);

  await uiLogin(page, bEmail);
  await page.goto('/loans');
  await expect(page.getByRole('heading', { name: 'Tomadores' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tomadores' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByText('Cleide Sigilosa')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Balanço' }).click();
  await expect(page.getByTestId('dash-total')).toHaveText('R$ 0,00');
});

// ---------------------------------------------------------------------------------------------
test('E2E-4: Price — amortização (prestação e prazo), antecipação sem recálculo e parcial como exceção', async ({ page }) => {
  const email = uniq('a4');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  await u.call('POST', '/loans/borrowers', { name: 'Tomador Price' });
  await uiLogin(page, email);
  await page.goto('/loans');

  await page.getByRole('tab', { name: 'Novo empréstimo' }).click();
  await page.getByLabel('Tomador').selectOption({ label: 'Tomador Price' });
  await page.getByLabel('Valor emprestado (R$)').fill('6000');
  await page.getByLabel('Modalidade').selectOption('price');
  await expect(page.getByText('Taxa efetiva mensal (%)')).toBeVisible();
  await page.getByLabel('Taxa').fill('2');
  await page.getByLabel('Parcelas').fill('6');
  await page.getByLabel('Primeiro vencimento').fill(brDate(addDays(TODAY, 30)));
  await page.getByRole('button', { name: 'Simular' }).click();
  const simTotals = await page.getByTestId('sim-total').allTextContents();
  expect(simTotals).toHaveLength(6);
  await page.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await page.getByRole('button', { name: 'Confirmar envio de R$ 6.000,00' }).click();
  await page.getByRole('button', { name: 'Abrir ficha do tomador' }).click();
  const loanId = (await u.call('GET', '/loans/contracts')).body[0].id;
  const before = (await u.call('GET', `/loans/contracts/${loanId}`)).body;

  // A1: reduzir prestação
  await page.getByRole('button', { name: 'Antecipar com recálculo (Price)' }).click();
  await page.getByLabel('Valor da amortização').fill('3000');
  await page.getByRole('button', { name: 'Pré-visualizar recálculo' }).click();
  await expect(page.getByText(/R\$ 6\.000,00 → R\$ 3\.000,00/)).toBeVisible();
  expect((await u.call('GET', `/loans/contracts/${loanId}`)).body.current_version).toBe(1); // preview não grava
  await page.getByRole('button', { name: 'Confirmar amortização de R$ 3.000,00' }).click();
  await expect(page.getByRole('status')).toContainText('cronograma recalculado');
  await expect(page.getByText('cronograma v2')).toBeVisible();
  const v2 = (await u.call('GET', `/loans/contracts/${loanId}`)).body;
  expect(v2.installments).toHaveLength(6);
  expect(cents(v2.installments[0].total)).toBeLessThan(cents(before.installments[0].total));
  expect(v2.installments.reduce((s, i) => s + cents(i.principal), 0)).toBe(300000);

  // A2: reduzir prazo
  await page.getByRole('button', { name: 'Antecipar com recálculo (Price)' }).click();
  await page.getByLabel('Valor da amortização').fill('1000');
  await page.getByLabel('Reduzir prazo (mantém prestação)').check();
  await page.getByRole('button', { name: 'Pré-visualizar recálculo' }).click();
  await page.getByRole('button', { name: 'Confirmar amortização de R$ 1.000,00' }).click();
  await expect(page.getByText('cronograma v3')).toBeVisible();
  const v3 = (await u.call('GET', `/loans/contracts/${loanId}`)).body;
  expect(v3.installments.length).toBeLessThan(6);
  expect(v3.installments.reduce((s, i) => s + cents(i.principal), 0)).toBe(200000);

  // B: antecipação sem recálculo da última parcela
  const last = v3.installments[v3.installments.length - 1];
  await page.getByLabel(`Selecionar parcela ${last.number} do empréstimo ${loanId}`).check();
  await page.getByRole('button', { name: 'Registrar recebimento' }).click();
  await page.getByRole('button', { name: /Confirmar recebimento de R\$/ }).click();
  await expect(page.getByTestId(`inst-${loanId}-${last.number}`)).toContainText('Paga');
  const v3b = (await u.call('GET', `/loans/contracts/${loanId}`)).body;
  expect(v3b.current_version).toBe(3); // sem novo recálculo
  expect(v3b.installments.find((i) => i.id === last.id).due_on).toBe(last.due_on);
  const anticip = (await u.call('GET', '/loans/receipts')).body.find((r) => r.kind === 'full');
  expect(anticip.allocations[0].kind).toBe('anticipation');

  // parcial como exceção
  const first = v3b.installments[0];
  await page.getByLabel(`Selecionar parcela ${first.number} do empréstimo ${loanId}`).check();
  await page.getByRole('button', { name: 'Registrar recebimento' }).click();
  await page.getByLabel('Pagamento parcial (exceção)').check();
  await page.getByLabel(`Valor parcial parcela ${first.number} empréstimo ${loanId}`).fill('100,00');
  await page.getByRole('button', { name: 'Confirmar recebimento de R$ 100,00' }).click();
  await expect(page.getByTestId(`inst-${loanId}-${first.number}`)).toContainText('Parcial');

  // invariante: principal recuperado (todas as allocations) + principal pendente no cronograma vigente == P
  const allocs = (await u.call('GET', '/loans/receipts')).body.filter((r) => !r.reversed).flatMap((r) => r.allocations);
  const recovered = allocs.reduce((s, a) => s + cents(a.principal), 0);
  const paidInSchedule = allocs.filter((a) => a.installment_id).reduce((s, a) => s + cents(a.principal), 0);
  const final = (await u.call('GET', `/loans/contracts/${loanId}`)).body;
  const pending = final.installments.reduce((s, i) => s + cents(i.principal), 0) - paidInSchedule;
  expect(recovered + pending).toBe(600000);
});

// ---------------------------------------------------------------------------------------------
test('E2E-5: atraso com badge sem alterar valores, acréscimo manual separado, Pix alternativa padrão persiste após reload', async ({ page }) => {
  const email = uniq('a5');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Atrasado' })).body.id;
  const start = addDays(TODAY, -90);
  const loan = await seedFundedLoan(u, bid, { principal: '3000.00', interest_method: 'fixed_addon', rate: '5', installment_count: 3,
    frequency: 'every_x_days', interval_days: 30, start_on: start, first_due_on: addDays(start, 30) }, start);

  await uiLogin(page, email);
  await page.goto('/loans');
  await page.getByRole('button', { name: 'Atrasado' }).click();
  const row1 = page.getByTestId(`inst-${loan.id}-1`);
  await expect(row1.getByTestId('overdue-badge')).toBeVisible();
  await expect(row1).toContainText('R$ 1.150,00');
  await expect(page.getByTestId('overdue-total')).not.toHaveText('R$ 0,00');
  expect((await u.call('GET', `/loans/contracts/${loan.id}`)).body.installments[0].interest).toBe('150.00');

  await row1.getByRole('button', { name: 'Acréscimo manual' }).click();
  await page.getByLabel('Valor do acréscimo').fill('25,00');
  await page.getByLabel('Motivo').fill('atraso combinado');
  await page.getByRole('button', { name: 'Confirmar acréscimo' }).click();
  await expect(page.getByRole('status')).toContainText('Acréscimo registrado');
  await expect(row1).toContainText('R$ 25,00');
  await expect(row1).toContainText('R$ 1.175,00');
  const inst = (await u.call('GET', `/loans/contracts/${loan.id}`)).body.installments[0];
  expect([inst.interest, inst.adjustment, inst.total]).toEqual(['150.00', '25.00', '1175.00']);

  await page.getByRole('tab', { name: 'Configurações' }).click();
  for (const [label, key] of [['Principal', 'p1@e2e.test'], ['Alternativa', '+5585999998888']]) {
    await page.getByLabel('Apelido').fill(label);
    await page.getByLabel('Chave Pix').fill(key);
    await page.getByLabel('Nome do recebedor').fill('Titular');
    await page.getByLabel('Cidade do recebedor').fill('Fortaleza');
    await page.getByRole('button', { name: 'Adicionar conta Pix' }).click();
    await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: 'Tornar padrão: Alternativa' }).click();
  await expect(page.getByRole('status')).toContainText('padrão atualizada');
  await page.reload();
  await page.getByRole('tab', { name: 'Configurações' }).click();
  const accounts = page.getByRole('list', { name: 'Contas Pix' }).getByRole('listitem');
  await expect(accounts.filter({ hasText: 'Alternativa' })).toContainText('Padrão');
  await expect(accounts.filter({ hasText: 'Principal' })).not.toContainText('Padrão');
  await expect(accounts.filter({ hasText: 'Alternativa' })).not.toContainText('+5585999998888'); // mascarada
});

// ---------------------------------------------------------------------------------------------
test('E2E-6: regressão legado — /home, login, refresh automático e participantes de Cartões', async ({ page }) => {
  const email = uniq('legacy');
  const u = await apiUser(email);
  const part = await u.call('POST', '/participants/', { name: 'Participante Legado' });
  expect(part.status).toBe(200);
  expect((await u.call('GET', '/modules/me')).body).toEqual({ cards_enabled: true, loans_enabled: false, default_module: 'cards' });

  await uiLogin(page, email);
  await expect(page).toHaveURL(/\/home$/);
  for (const t of ['Lançamentos', 'Extrato bancário', 'Participantes', 'Balanço', 'Agente']) {
    await expect(page.getByRole('tab', { name: t })).toBeVisible();
  }
  await page.getByRole('tab', { name: 'Participantes' }).click();
  await expect(page.getByText('Participante Legado')).toBeVisible();

  // access token inválido → interceptor usa refresh_token e a página continua funcionando
  await page.evaluate(() => localStorage.setItem('token', 'token-invalido'));
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/auth/refresh') && r.status() === 200);
  await page.reload();
  await refreshed;
  await page.getByRole('tab', { name: 'Participantes' }).click();
  await expect(page.getByText('Participante Legado')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBe('token-invalido');

  // logout → rota protegida volta ao login
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
});

// ---------------------------------------------------------------------------------------------
test('E2E-mobile @mobile: ficha e cobrança responsivas sem overflow horizontal', async ({ page }) => {
  const email = uniq('mob');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Cleide Mobile' })).body.id;
  await u.call('POST', '/loans/pix-accounts', { label: 'Nubank', key: 'mob@e2e.test', holder_name: 'Titular', city: 'Fortaleza' });
  const loan = await seedFundedLoan(u, bid, { principal: '3000.00', interest_method: 'fixed_addon', rate: '5', installment_count: 3,
    frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30) });
  await uiLogin(page, email);
  await page.goto('/loans');
  await page.getByRole('button', { name: 'Cleide Mobile' }).click();
  await page.getByLabel(`Selecionar parcela 1 do empréstimo ${loan.id}`).check();
  // Chromium deve rolar o scroller correto e clicar naturalmente, sem force/JS hit-test.
  const gen = page.getByRole('button', { name: 'Gerar cobrança Pix' });
  await gen.click();
  await page.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
  await expect(page.getByTestId('pix-qr')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('R6-E2E: cancelar rascunho exige confirmação e não lança desembolso', async ({ page }) => {
  const email = uniq('r6draft');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Rascunho R6' })).body.id;
  const created = await u.call('POST', '/loans/contracts', {
    borrower_id: bid, principal: '1000.00', interest_method: 'fixed_addon', rate: '5',
    installment_count: 3, frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30),
    idempotency_key: 'r6-draft-' + Date.now(),
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await uiLogin(page, email);
  await page.goto('/loans');
  await page.getByRole('button', { name: 'Rascunho R6' }).click();
  await expect(page.getByRole('button', { name: 'Cancelar rascunho' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar rascunho' }).click();
  expect((await u.call('GET', '/loans/contracts/' + created.body.id)).body.status).toBe('DRAFT');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('status')).toContainText('Rascunho cancelado.');
  expect((await u.call('GET', '/loans/contracts/' + created.body.id)).body.status).toBe('CANCELLED');
  expect((await u.call('GET', '/loans/dashboard')).body.principal_outstanding).toBe('0.00');
  await expect(page.getByRole('button', { name: 'Cancelar rascunho' })).toHaveCount(0);
});

test('R6-E2E: estorno de acréscimo e histórico Pix imutável após recebimento', async ({ page }) => {
  const email = uniq('r6history');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Histórico R6' })).body.id;
  await u.call('POST', '/loans/pix-accounts', {
    label: 'Recebedor histórico', key: 'r6@e2e.test', holder_name: 'Titular R6', city: 'Fortaleza',
  });
  const start = addDays(TODAY, -90);
  const loan = await seedFundedLoan(u, bid, {
    principal: '3000.00', interest_method: 'fixed_addon', rate: '5', installment_count: 3,
    frequency: 'every_x_days', interval_days: 30, start_on: start, first_due_on: addDays(start, 30),
  }, start);
  const [i1, i2] = loan.installments;
  const adj1 = await u.call('POST', '/loans/installments/' + i1.id + '/adjustments', {
    amount: '25.00', reason: 'acordo recebido', idempotency_key: 'adj-r6-1-' + Date.now(),
  });
  const adj2 = await u.call('POST', '/loans/installments/' + i2.id + '/adjustments', {
    amount: '10.00', reason: 'acordo estornável', idempotency_key: 'adj-r6-2-' + Date.now(),
  });
  expect(adj1.status).toBe(201);
  expect(adj2.status).toBe(201);
  const charge = await u.call('POST', '/loans/charges', { borrower_id: bid, installment_ids: [i1.id] });
  expect(charge.status).toBe(201);
  const receipt = await u.call('POST', '/loans/receipts', {
    borrower_id: bid, received_on: TODAY, amount: '1175.00', items: [{ installment_id: i1.id }],
    idempotency_key: 'r6-paid-' + Date.now(),
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  await uiLogin(page, email);
  await page.goto('/loans');
  await page.getByRole('button', { name: 'Histórico R6' }).click();
  await expect(page.getByText('Acréscimo já recebido; estorne o recebimento antes.')).toBeVisible();
  await page.getByRole('button', { name: 'Estornar acréscimo #' + adj2.body.id }).click();
  expect((await u.call('GET', '/loans/borrowers/' + bid + '/statement')).body.adjustments.find((a) => a.id === adj2.body.id).reversed).toBe(false);
  await page.getByRole('button', { name: 'Confirmar estorno do acréscimo' }).click();
  await expect(page.getByRole('status')).toContainText('Acréscimo estornado.');
  expect((await u.call('GET', '/loans/borrowers/' + bid + '/statement')).body.adjustments.find((a) => a.id === adj2.body.id).reversed).toBe(true);
  await page.getByRole('button', { name: 'Abrir cobrança #' + charge.body.id }).click();
  await expect(page.getByLabel('Cobrança ' + charge.body.id)).toBeVisible();
  await expect(page.getByTestId('pix-qr')).toBeVisible();
  await expect(page.getByText(/Valores atuais podem divergir/)).toBeVisible();
  await expect(page.getByTestId('pix-brcode')).toHaveValue(charge.body.brcode);
  expect((await u.call('GET', '/loans/charges')).body).toHaveLength(1);
  expect((await u.call('GET', '/loans/receipts')).body).toHaveLength(1);
});

test('R6-E2E: escolha de A não contamina módulo padrão de B no mesmo navegador', async ({ page }) => {
  const a = await apiUser(uniq('r6accounta'));
  const b = await apiUser(uniq('r6accountb'));
  expect((await a.call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'cards' })).status).toBe(200);
  expect((await b.call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'loans' })).status).toBe(200);
  await uiLogin(page, a.email);
  await page.getByRole('button', { name: 'Empréstimos' }).click();
  await expect(page).toHaveURL(/\/loans$/);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
  await uiLogin(page, b.email);
  await expect(page).toHaveURL(/\/loans$/);
  await page.getByRole('button', { name: 'Cartões' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
});

test('R7-A1: mesma conta — seleção persiste no refresh mas logout de Cartões restaura padrão', async ({ page }) => {
  const a = await apiUser(uniq('r7same'));
  expect((await a.call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'loans' })).status).toBe(200);
  await uiLogin(page, a.email);
  await expect(page).toHaveURL(/\/loans$/);
  await page.getByRole('button', { name: 'Cartões' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
  expect((await a.call('GET', '/modules/me')).body.default_module).toBe('loans');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
  await uiLogin(page, a.email);
  await expect(page).toHaveURL(/\/loans$/);
  expect((await a.call('GET', '/modules/me')).body.default_module).toBe('loans');
});

test('R7-A2: logout de Empréstimos apaga seleção da mesma conta; B inicia no próprio padrão', async ({ page }) => {
  const a = await apiUser(uniq('r7fromloans'));
  const b = await apiUser(uniq('r7other'));
  await a.call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'cards' });
  await b.call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'cards' });
  await uiLogin(page, a.email);
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button', { name: 'Empréstimos' }).click();
  await expect(page).toHaveURL(/\/loans$/);
  await page.reload();
  await expect(page).toHaveURL(/\/loans$/);
  const moduleKey = 'cobalance.activeModule:' + a.email.toLowerCase();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), moduleKey)).toBe('loans');
  await page.evaluate(() => sessionStorage.setItem('unrelated.session.data', 'keep'));
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), moduleKey)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated.session.data'))).toBe('keep');
  await uiLogin(page, b.email);
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button', { name: 'Sair' }).click();
  await uiLogin(page, a.email);
  await expect(page).toHaveURL(/\/home$/);
  expect((await a.call('GET', '/modules/me')).body.default_module).toBe('cards');
});

test('R7-A3: módulo desativado não restaura preferência e conserva outras chaves de sessão', async ({ page }) => {
  const a = await apiUser(uniq('r7disabled'));
  await a.call('PATCH', '/modules/me', { loans_enabled: true, default_module: 'cards' });
  await uiLogin(page, a.email);
  await page.getByRole('button', { name: 'Empréstimos' }).click();
  await expect(page).toHaveURL(/\/loans$/);
  await page.evaluate(() => sessionStorage.setItem('unrelated.session.data', 'preserve'));
  await a.call('PATCH', '/modules/me', { loans_enabled: false });
  await page.goto('/home');
  await expect(page.getByRole('button', { name: 'Cartões' })).toHaveAttribute('aria-current', 'page');
  const key = 'cobalance.activeModule:' + a.email.toLowerCase();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), key)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated.session.data'))).toBe('preserve');
  await page.getByRole('button', { name: 'Sair' }).click();
  await uiLogin(page, a.email);
  await expect(page).toHaveURL(/\/home$/);
});

test('R7-B: rascunho, cancelamento, dívida ativa, quitação e cobrança permanecem coerentes', async ({ page }) => {
  const email = uniq('r7states');
  const u = await apiUser(email);
  await u.call('PATCH', '/modules/me', { loans_enabled: true });
  const bid = (await u.call('POST', '/loans/borrowers', { name: 'Estados R7' })).body.id;
  await u.call('POST', '/loans/pix-accounts', {
    label: 'Pix R7', key: 'pixr7@e2e.test', holder_name: 'Titular', city: 'Fortaleza',
  });
  const make = async (n) => {
    const r = await u.call('POST', '/loans/contracts', {
      borrower_id: bid, principal: '3000.00', interest_method: 'fixed_addon', rate: '5',
      installment_count: 3, frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30),
      idempotency_key: 'r7-contract-' + n + '-' + Date.now(),
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body;
  };
  const draft = await make('draft');
  const cancelled = await make('cancelled');
  expect((await u.call('POST', '/loans/contracts/' + cancelled.id + '/cancel')).status).toBe(200);
  const active = await seedFundedLoan(u, bid, {
    principal: '3000.00', interest_method: 'fixed_addon', rate: '5',
    installment_count: 3, frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30),
  });
  const settled = await seedFundedLoan(u, bid, {
    principal: '1000.00', interest_method: 'fixed_addon', rate: '5',
    installment_count: 1, frequency: 'monthly', start_on: TODAY, first_due_on: addDays(TODAY, 30),
  });
  const paid = await u.call('POST', '/loans/receipts', {
    borrower_id: bid, received_on: TODAY, amount: '1050.00',
    items: [{ installment_id: settled.installments[0].id }],
    idempotency_key: 'r7-paid-' + Date.now(),
  });
  expect(paid.status, JSON.stringify(paid.body)).toBe(201);
  const expected = (await u.call('GET', '/loans/borrowers/' + bid + '/statement')).body;
  expect(expected.open_total).toBe('3450.00');
  expect(expected.overdue_total).toBe('0.00');
  await uiLogin(page, email);
  await page.goto('/loans');
  await page.getByRole('button', { name: 'Estados R7' }).click();
  const d = page.getByTestId('loan-' + draft.id);
  const c = page.getByTestId('loan-' + cancelled.id);
  const act = page.getByTestId('loan-' + active.id);
  const st = page.getByTestId('loan-' + settled.id);
  await expect(d).toContainText('Rascunho — envio não confirmado');
  await expect(d).toContainText('Capital previsto');
  await expect(d.getByRole('button', { name: 'Cancelar rascunho' })).toBeVisible();
  await expect(c).toContainText('Cancelado — sem obrigação financeira');
  await expect(c.getByTestId('inst-' + cancelled.id + '-1')).toContainText('Cancelada — sem obrigação');
  await expect(c.getByText('Em aberto', { exact: true })).toHaveCount(0);
  await expect(c.getByTestId('overdue-badge')).toHaveCount(0);
  await expect(c.getByRole('checkbox')).toHaveCount(0);
  await expect(st).toContainText('Quitado — sem saldo pendente');
  await expect(st.getByTestId('inst-' + settled.id + '-1')).toContainText('Quitada');
  await expect(page.getByTestId('open-total')).toHaveText('R$ 3.450,00');
  await expect(act.getByTestId('inst-' + active.id + '-1')).toContainText('Em aberto');
  await expect(page.getByRole('button', { name: 'Gerar cobrança Pix' })).toBeDisabled();
  await act.getByLabel('Selecionar parcela 1 do empréstimo ' + active.id).check();
  await page.getByRole('button', { name: 'Gerar cobrança Pix' }).click();
  await page.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
  await expect(page.getByTestId('pix-qr')).toBeVisible();
  const charges = (await u.call('GET', '/loans/charges')).body;
  expect(charges).toHaveLength(1);
  expect(charges[0].items.map((x) => x.loan_id)).toEqual([active.id]);
  await page.getByRole('button', { name: 'Registrar recebimento' }).click();
  await page.getByRole('button', { name: /Confirmar recebimento de R\$ 1\.150,00/ }).click();
  await expect(act.getByTestId('inst-' + active.id + '-1')).toContainText('Paga');
  expect((await u.call('GET', '/loans/borrowers/' + bid + '/statement')).body.open_total).toBe('2300.00');
  expect((await u.call('GET', '/loans/contracts/' + cancelled.id)).body.status).toBe('CANCELLED');
});
