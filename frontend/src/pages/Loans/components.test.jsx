import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../services/loansService', () => {
  const loansApi = {
    createReceipt: vi.fn(), createCharge: vi.fn(), markShared: vi.fn(), statement: vi.fn(), listPix: vi.fn(),
    simulate: vi.fn(), createContract: vi.fn(), listBorrowers: vi.fn(), fund: vi.fn(), reverseReceipt: vi.fn(),
    cancel: vi.fn(), reverseAdjustment: vi.fn(), charge: vi.fn(),
  };
  return { loansApi, modules: { get: vi.fn(), patch: vi.fn() }, apiError: (e) => e?.message || 'erro' };
});
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')) } }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import { loansApi, modules } from '../../services/loansService';
import api from '../../services/api';
import ReceiptDialog from './ReceiptDialog';
import ChargePanel, { ChargeView } from './ChargePanel';
import BorrowerStatement from './BorrowerStatement';
import NewLoanTab from './NewLoanTab';
import ModuleSwitcher from '../../components/ModuleSwitcher/ModuleSwitcher';

const items = [
  { id: 11, loan_id: 1, number: 1, due_on: '2026-12-10', remaining: '1150.00' },
  { id: 21, loan_id: 2, number: 1, due_on: '2026-12-10', remaining: '300.00' },
];
const pix = [
  { id: 1, label: 'Nubank', key_masked: 'al***@x', is_default: true, is_active: true },
  { id: 2, label: 'Inter', key_masked: '+5585*****8888', is_default: false, is_active: true },
  { id: 3, label: 'Antiga', key_masked: 'x', is_default: false, is_active: false },
];

beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: { email: 'user@example.test' } }); });

describe('ReceiptDialog', () => {
  it('integral por padrão: parcial escondido e total consolidado', async () => {
    loansApi.createReceipt.mockResolvedValue({ amount: '1450.00', allocations: [{}, {}] });
    const onDone = vi.fn();
    render(<ReceiptDialog borrowerId={7} items={items} pixAccounts={pix} onDone={onDone} onCancel={() => {}} />);
    expect(screen.queryByLabelText(/Valor parcial/)).toBeNull();
    const btn = screen.getByRole('button', { name: 'Confirmar recebimento de R$ 1.450,00' });
    await userEvent.click(btn);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const body = loansApi.createReceipt.mock.calls[0][0];
    expect(body).toMatchObject({ borrower_id: 7, kind: 'full', amount: '1450.00', items: [{ installment_id: 11 }, { installment_id: 21 }] });
    expect(body.idempotency_key).toMatch(/^receipt-/);
  });

  it('parcial só após marcar exceção, com valor por parcela', async () => {
    loansApi.createReceipt.mockResolvedValue({ amount: '575.00', allocations: [{}] });
    render(<ReceiptDialog borrowerId={7} items={[items[0]]} pixAccounts={pix} onDone={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByLabelText('Pagamento parcial (exceção)'));
    expect(screen.getByRole('button', { name: /Confirmar recebimento de —/ })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Valor parcial parcela 1 empréstimo 1'), '575,00');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento de R$ 575,00' }));
    expect(loansApi.createReceipt.mock.calls[0][0]).toMatchObject({ kind: 'partial', amount: '575.00', items: [{ installment_id: 11, amount: '575.00' }] });
  });

  it('mesma chave de idempotência em reenvio após erro', async () => {
    loansApi.createReceipt.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ amount: '1150.00', allocations: [{}] });
    render(<ReceiptDialog borrowerId={7} items={[items[0]]} pixAccounts={pix} onDone={() => {}} onCancel={() => {}} />);
    const btn = screen.getByRole('button', { name: /Confirmar recebimento/ });
    await userEvent.click(btn);
    await screen.findByRole('alert');
    await userEvent.click(btn);
    const [k1, k2] = loansApi.createReceipt.mock.calls.map((c) => c[0].idempotency_key);
    expect(k1).toBe(k2);
  });
});

describe('Cobrança Pix', () => {
  it('pré-seleciona a conta padrão ativa e permite alternativa', async () => {
    loansApi.createCharge.mockResolvedValue({ id: 5 });
    render(<ChargePanel borrowerId={7} items={items} pixAccounts={pix} onCreated={() => {}} onCancel={() => {}} />);
    const sel = screen.getByLabelText('Conta Pix de destino');
    expect(sel).toHaveValue('1');
    expect(within(sel).queryByText(/Antiga/)).toBeNull();
    await userEvent.selectOptions(sel, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar cobrança' }));
    expect(loansApi.createCharge).toHaveBeenCalledWith({ borrower_id: 7, installment_ids: [11, 21], pix_account_id: 2 });
  });

  it('compartilhar não registra pagamento; fallback copia mensagem', async () => {
    const charge = { id: 5, total: '1450.00', status: 'GENERATED', brcode: '000201...6304ABCD', message: 'Olá', holder_name: 'A', city: 'F',
      items: [], values_may_have_changed: false };
    loansApi.markShared.mockResolvedValue({ ...charge, status: 'SHARED' });
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    render(<ChargeView charge={charge} onShared={() => {}} />);
    expect(screen.getByRole('note')).toHaveTextContent('não registra pagamento');
    expect(await screen.findByAltText('QR Code Pix estático')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar mensagem' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Olá'));
    expect(loansApi.markShared).toHaveBeenCalledWith(5);
    expect(loansApi.createReceipt).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar Pix Copia e Cola' }));
    expect(writeText).toHaveBeenLastCalledWith('000201...6304ABCD');
  });
});

describe('Ficha do tomador', () => {
  const statement = {
    borrower: { id: 7, name: 'Cleide' }, open_total: '4650.00', overdue_total: '1150.00', receipts: [], charges: [],
    loans: [
      { id: 1, principal: '3000.00', interest_method: 'fixed_addon', rate: '5', status: 'ACTIVE', current_version: 1, installments: [
        { id: 11, loan_id: 1, number: 1, due_on: '2026-10-10', principal: '1000.00', interest: '150.00', adjustment: '0.00', total: '1150.00', remaining: '1150.00', status: 'PENDING', overdue: true },
        { id: 12, loan_id: 1, number: 2, due_on: '2026-11-10', principal: '1000.00', interest: '150.00', adjustment: '0.00', total: '1150.00', remaining: '0.00', status: 'PAID', overdue: false },
      ] },
      { id: 2, principal: '1000.00', interest_method: 'price', rate: '2', status: 'ACTIVE', current_version: 2, installments: [
        { id: 21, loan_id: 2, number: 1, due_on: '2026-12-10', principal: '280.00', interest: '20.00', adjustment: '0.00', total: '300.00', remaining: '300.00', status: 'PENDING', overdue: false },
      ] },
    ],
  };

  it('exibe atraso sem alterar valor, seleção consolidada entre contratos', async () => {
    loansApi.statement.mockResolvedValue(statement);
    loansApi.listPix.mockResolvedValue(pix);
    render(<BorrowerStatement borrowerId={7} />);
    expect(await screen.findByText('Cleide')).toBeInTheDocument();
    const row = screen.getByTestId('inst-1-1');
    expect(within(row).getByTestId('overdue-badge')).toBeInTheDocument();
    expect(within(row).getAllByText('R$ 1.150,00').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Selecionar parcela 2 do empréstimo 1')).toBeNull(); // paga
    await userEvent.click(screen.getByLabelText('Selecionar parcela 1 do empréstimo 1'));
    await userEvent.click(screen.getByLabelText('Selecionar parcela 1 do empréstimo 2'));
    expect(screen.getByText(/Selecionadas: 2 · Total R\$ 1.450,00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Antecipar com recálculo (Price)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acréscimo manual' })).toBeInTheDocument();
  });
});

describe('Novo empréstimo', () => {
  it('simular não persiste; salvar só após simulação', async () => {
    loansApi.listBorrowers.mockResolvedValue([{ id: 7, name: 'Cleide' }]);
    loansApi.simulate.mockResolvedValue({ terms_hash: 'h', totals: { principal: '3000.00', interest: '450.00', total: '3450.00' },
      installments: [1, 2, 3].map((n) => ({ number: n, due_on: '2026-12-10', principal: '1000.00', interest: '150.00', total: '1150.00' })) });
    loansApi.createContract.mockResolvedValue({ id: 9, status: 'DRAFT', principal: '3000.00', borrower_id: 7 });
    render(<NewLoanTab onOpenBorrower={() => {}} />);
    await screen.findByRole('option', { name: 'Cleide' });
    expect(screen.queryByRole('button', { name: 'Salvar como rascunho' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Tomador'), '7');
    await userEvent.type(screen.getByLabelText('Valor emprestado (R$)'), '3000');
    await userEvent.type(screen.getByLabelText('Primeiro vencimento'), '2026-12-10');
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByTestId('sim-grand')).toHaveTextContent('R$ 3.450,00');
    expect(loansApi.createContract).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Taxa').closest('label')).toHaveTextContent('Adicional por parcela');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar como rascunho' }));
    expect(loansApi.createContract.mock.calls[0][0]).toMatchObject({ borrower_id: 7, principal: '3000.00', terms_hash: 'h' });
    expect(await screen.findByRole('button', { name: 'Confirmar envio de R$ 3.000,00' })).toBeInTheDocument();
  });
});

describe('ModuleSwitcher', () => {
  const renderAt = (ui, path = '/home') => render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/home" element={ui} /><Route path="/loans" element={<p>tela empréstimos</p>} /></Routes>
    </MemoryRouter>,
  );

  it('oferece ativação quando Empréstimos desligado', async () => {
    modules.get.mockResolvedValue({ cards_enabled: true, loans_enabled: false, default_module: 'cards' });
    modules.patch.mockResolvedValue({ cards_enabled: true, loans_enabled: true, default_module: 'cards' });
    renderAt(<ModuleSwitcher current="cards" redirectToDefault />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ativar Empréstimos' }));
    expect(modules.patch).toHaveBeenCalledWith({ loans_enabled: true });
    expect(await screen.findByText('tela empréstimos')).toBeInTheDocument();
  });

  it('marca ambiente atual e redireciona para default sem escolha local', async () => {
    modules.get.mockResolvedValue({ cards_enabled: true, loans_enabled: true, default_module: 'loans' });
    renderAt(<ModuleSwitcher current="cards" redirectToDefault />);
    expect(await screen.findByText('tela empréstimos')).toBeInTheDocument();
  });

  it('respeita escolha local da sessão', async () => {
    sessionStorage.setItem('cobalance.activeModule:user@example.test', 'cards');
    modules.get.mockResolvedValue({ cards_enabled: true, loans_enabled: true, default_module: 'loans' });
    renderAt(<ModuleSwitcher current="cards" redirectToDefault />);
    const cur = await screen.findByRole('button', { name: 'Cartões' });
    expect(cur).toHaveAttribute('aria-current', 'page');
  });
});

describe('SPEC003-R6 — ações na ficha e histórico', () => {
  const base = {
    borrower: { id: 7, name: 'Cleide' }, open_total: '0.00', overdue_total: '0.00',
    receipts: [], charges: [], adjustments: [],
    loans: [{ id: 44, principal: '1000.00', interest_method: 'fixed_addon', rate: '5',
      status: 'DRAFT', current_version: 1, installments: [] }],
  };

  it('cancela rascunho somente após confirmação e atualiza ficha', async () => {
    loansApi.statement.mockResolvedValueOnce(base).mockResolvedValueOnce({
      ...base, loans: [{ ...base.loans[0], status: 'CANCELLED' }],
    });
    loansApi.listPix.mockResolvedValue([]);
    loansApi.cancel.mockResolvedValue({ status: 'CANCELLED' });
    render(<BorrowerStatement borrowerId={7} />);
    await screen.findByRole('button', { name: 'Cancelar rascunho' });
    expect(loansApi.cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar rascunho' }));
    expect(loansApi.cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    await waitFor(() => expect(loansApi.cancel).toHaveBeenCalledWith(44));
    expect(await screen.findByText('Rascunho cancelado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar rascunho' })).toBeNull();
  });

  it('estorna acréscimo aberto e apresenta motivo quando não é reversível', async () => {
    const adj = { id: 88, loan_id: 44, installment_id: 99, installment_number: 1,
      amount: '25.00', reason: 'acordo', reversed: false, can_reverse: true, blocked_reason: null };
    loansApi.statement.mockResolvedValueOnce({ ...base, adjustments: [adj] })
      .mockResolvedValueOnce({ ...base, adjustments: [{ ...adj, reversed: true, can_reverse: false,
        blocked_reason: 'Acréscimo já estornado.' }] });
    loansApi.listPix.mockResolvedValue([]);
    loansApi.reverseAdjustment.mockResolvedValue({});
    render(<BorrowerStatement borrowerId={7} />);
    const estornar = await screen.findByRole('button', { name: 'Estornar acréscimo #88' });
    expect(estornar).toBeInTheDocument();
    await userEvent.click(estornar);
    expect(loansApi.reverseAdjustment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar estorno do acréscimo' }));
    await waitFor(() => expect(loansApi.reverseAdjustment).toHaveBeenCalledWith(88));
    expect(await screen.findByText('Acréscimo já estornado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Estornar acréscimo #88' })).toBeNull();
  });

  it('reabre cobrança histórica sem recriar cobrança nem recibo', async () => {
    const old = { id: 71, total: '1150.00', status: 'GENERATED', brcode: '000201...', message: 'Cobrança original',
      pix_key: 'antiga@pix.test', holder_name: 'Antigo titular', city: 'Fortaleza',
      items: [{ installment_id: 99, loan_id: 44, installment_number: 1, due_on: '2026-12-10', amount: '1150.00' }],
      values_may_have_changed: true };
    loansApi.statement.mockResolvedValue({ ...base, charges: [{ id: 71, total: '1150.00', status: 'GENERATED' }] });
    loansApi.listPix.mockResolvedValue([]);
    loansApi.charge.mockResolvedValue(old);
    render(<BorrowerStatement borrowerId={7} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir cobrança #71' }));
    expect(await screen.findByLabelText('Cobrança 71')).toBeInTheDocument();
    expect(screen.getByText('Cobrança original')).toBeInTheDocument();
    expect(screen.getByText(/Valores atuais podem divergir/)).toBeInTheDocument();
    expect(loansApi.charge).toHaveBeenCalledWith(71);
    expect(loansApi.createCharge).not.toHaveBeenCalled();
    expect(loansApi.createReceipt).not.toHaveBeenCalled();
  });
});

describe('SPEC003-R6 — sessão multiusuário', () => {
  const renderAt = (ui) => render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes><Route path="/home" element={ui} /><Route path="/loans" element={<p>tela empréstimos</p>} /></Routes>
    </MemoryRouter>,
  );

  it('não reaproveita escolha global de A no login de B', async () => {
    sessionStorage.setItem('cobalance.activeModule', 'cards');
    sessionStorage.setItem('cobalance.activeModule:a@example.test', 'cards');
    api.get.mockResolvedValue({ data: { email: 'b@example.test' } });
    modules.get.mockResolvedValue({ cards_enabled: true, loans_enabled: true, default_module: 'loans' });
    renderAt(<ModuleSwitcher current="cards" redirectToDefault />);
    expect(await screen.findByText('tela empréstimos')).toBeInTheDocument();
  });

  it('ignora preferência da própria conta se módulo foi desativado', async () => {
    sessionStorage.setItem('cobalance.activeModule:user@example.test', 'loans');
    modules.get.mockResolvedValue({ cards_enabled: true, loans_enabled: false, default_module: 'cards' });
    renderAt(<ModuleSwitcher current="cards" redirectToDefault />);
    expect(await screen.findByRole('button', { name: 'Cartões' })).toHaveAttribute('aria-current', 'page');
    expect(sessionStorage.getItem('cobalance.activeModule:user@example.test')).toBeNull();
  });

  it('escolha manual por conta permanece ao remontar no mesmo login', async () => {
    modules.get.mockResolvedValue({ cards_enabled: true, loans_enabled: true, default_module: 'loans' });
    sessionStorage.setItem('cobalance.activeModule:user@example.test', 'cards');
    renderAt(<ModuleSwitcher current="cards" redirectToDefault />);
    const cur = await screen.findByRole('button', { name: 'Cartões' });
    expect(cur).toHaveAttribute('aria-current', 'page');
  });
});

it('SPEC003-R6: simulação Price extrema informa ajuste final sem bloquear salvamento', async () => {
  loansApi.listBorrowers.mockResolvedValue([{ id: 7, name: 'Cleide' }]);
  loansApi.simulate.mockResolvedValue({
    terms_hash: 'price-hash', warnings: [{
      code: 'PRICE_LAST_INSTALLMENT_DISTORTION',
      message: 'O arredondamento acumulado gera uma última prestação diferente das anteriores.',
      first_installment: '99901.09', last_installment: '98068.81', difference: '-1832.28',
    }],
    totals: { principal: '999999.99', interest: '9999999.99', total: '10999999.98' },
    installments: [{ number: 1, due_on: '2026-12-10', principal: '1.00', interest: '99900.09', total: '99901.09' }],
  });
  render(<NewLoanTab onOpenBorrower={() => {}} />);
  await screen.findByRole('option', { name: 'Cleide' });
  await userEvent.selectOptions(screen.getByLabelText('Tomador'), '7');
  await userEvent.selectOptions(screen.getByLabelText('Modalidade'), 'price');
  await userEvent.type(screen.getByLabelText('Valor emprestado (R$)'), '999999.99');
  await userEvent.type(screen.getByLabelText('Primeiro vencimento'), '2026-12-10');
  await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/última prestação/);
  expect(screen.getByRole('button', { name: 'Salvar como rascunho' })).toBeEnabled();
});

// R7 — semântica visual dos estados; fixtures com parcelas históricas NÃO representam dívida.
describe('SPEC003-R7 — estados contratuais na ficha', () => {
  const installment = (id, loanId, status, remaining, overdue = false) => ({
    id, loan_id: loanId, number: 1, due_on: '2026-12-10',
    principal: '1000.00', interest: '150.00', adjustment: '0.00', total: '1150.00',
    remaining, status, overdue,
  });
  const loan = (id, status, inst) => ({
    id, status, principal: '1000.00', interest_method: 'fixed_addon', rate: '5',
    current_version: 1, installments: [inst],
  });
  const statement = {
    borrower: { id: 7, name: 'Tomador R7' },
    open_total: '1150.00', overdue_total: '1150.00', receipts: [], charges: [], adjustments: [],
    loans: [
      loan(10, 'DRAFT', installment(101, 10, 'PENDING', '1150.00', true)),
      loan(20, 'CANCELLED', installment(201, 20, 'PENDING', '1150.00', true)),
      loan(30, 'ACTIVE', installment(301, 30, 'PENDING', '1150.00', true)),
      loan(40, 'SETTLED', installment(401, 40, 'PAID', '0.00')),
    ],
  };

  it('DRAFT indica capital apenas planejado, sem obrigação exigível, mantendo ações adequadas', async () => {
    loansApi.statement.mockResolvedValue(statement); loansApi.listPix.mockResolvedValue([]);
    render(<BorrowerStatement borrowerId={7} />);
    const card = await screen.findByTestId('loan-10');
    expect(card).toHaveTextContent('Rascunho — envio não confirmado');
    expect(card).toHaveTextContent(/Capital previsto/);
    expect(within(card).getByRole('button', { name: /Confirmar envio/ })).toBeVisible();
    expect(within(card).getByRole('button', { name: 'Cancelar rascunho' })).toBeVisible();
    expect(within(card).getByTestId('inst-10-1')).toHaveTextContent('Prevista — sem envio');
    expect(within(card).queryByText('Em aberto', { exact: true })).toBeNull();
    expect(within(card).queryByTestId('overdue-badge')).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Acréscimo manual' })).toBeNull();
    expect(within(card).queryByLabelText('Selecionar parcela 1 do empréstimo 10')).toBeNull();
  });

  it('CANCELLED continua consultável com valores contratuais, mas não mostra dívida em aberto', async () => {
    loansApi.statement.mockResolvedValue(statement); loansApi.listPix.mockResolvedValue([]);
    render(<BorrowerStatement borrowerId={7} />);
    const card = await screen.findByTestId('loan-20');
    expect(card).toHaveTextContent('Cancelado — sem obrigação financeira');
    expect(card).toHaveTextContent('R$ 1.150,00'); // termo original, não saldo exigível
    expect(within(card).getByTestId('inst-20-1')).toHaveTextContent('Cancelada — sem obrigação');
    expect(within(card).queryByText('Em aberto', { exact: true })).toBeNull();
    expect(within(card).queryByTestId('overdue-badge')).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Acréscimo manual' })).toBeNull();
    expect(within(card).queryByLabelText('Selecionar parcela 1 do empréstimo 20')).toBeNull();
  });

  it('ACTIVE permanece exigível, selecionável para Pix/recebimento e soma apenas obrigação real', async () => {
    loansApi.statement.mockResolvedValue(statement); loansApi.listPix.mockResolvedValue([]);
    render(<BorrowerStatement borrowerId={7} />);
    const card = await screen.findByTestId('loan-30');
    const input = await within(card).findByLabelText('Selecionar parcela 1 do empréstimo 30');
    expect(within(card).getByTestId('inst-30-1')).toHaveTextContent('Em aberto');
    expect(within(card).getByTestId('overdue-badge')).toBeInTheDocument();
    await userEvent.click(input);
    expect(screen.getByTestId('open-total')).toHaveTextContent('R$ 1.150,00');
    expect(screen.getByTestId('overdue-total')).toHaveTextContent('R$ 1.150,00');
    expect(screen.getByText(/Selecionadas: 1 · Total R\$ 1\.150,00/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gerar cobrança Pix' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Registrar recebimento' })).toBeEnabled();
    expect(within(screen.getByTestId('loan-20')).queryByRole('checkbox')).toBeNull();
  });

  it('SETTLED apresenta quitação, sem saldo atual e sem seleção', async () => {
    loansApi.statement.mockResolvedValue(statement); loansApi.listPix.mockResolvedValue([]);
    render(<BorrowerStatement borrowerId={7} />);
    const card = await screen.findByTestId('loan-40');
    expect(card).toHaveTextContent('Quitado — sem saldo pendente');
    expect(within(card).getByTestId('inst-40-1')).toHaveTextContent('Quitada');
    expect(within(card).queryByLabelText('Selecionar parcela 1 do empréstimo 40')).toBeNull();
    expect(within(card).queryByText('Em aberto', { exact: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Gerar cobrança Pix' })).toBeDisabled();
  });
});
