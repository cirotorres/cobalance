import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/loansService', () => ({
  loansApi: { listBorrowers: vi.fn(), simulate: vi.fn(), createContract: vi.fn() },
  apiError: (error) => error?.message || 'erro',
}));

import { loansApi } from '../../services/loansService';
import NewLoanTab from './NewLoanTab';
import { buildTerms } from './terms';

const simulation = (hash) => ({
  terms_hash: hash, warnings: [],
  installments: [{ number: 1, due_on: '2026-12-10', principal: '100.00', interest: '0.00', total: '100.00' }],
  totals: { principal: '100.00', interest: '0.00', total: '100.00' },
});

beforeEach(() => {
  vi.clearAllMocks();
  loansApi.listBorrowers.mockResolvedValue([{ id: 7, name: 'Ana' }, { id: 8, name: 'Breno' }]);
  loansApi.createContract.mockResolvedValue({ id: 22, status: 'DRAFT', principal: '100.00', borrower_id: 8 });
});

async function setupForm() {
  const user = userEvent.setup();
  render(<NewLoanTab onOpenBorrower={() => {}} />);
  await screen.findByRole('option', { name: 'Ana' });
  await user.selectOptions(screen.getByLabelText('Tomador'), '7');
  await user.type(screen.getByLabelText('Valor emprestado (R$)'), '100');
  await user.clear(screen.getByLabelText('Data de início'));
  await user.type(screen.getByLabelText('Data de início'), '09112026');
  await user.type(screen.getByLabelText('Primeiro vencimento'), '10122026');
  return user;
}

describe('SPEC004-R2 — F2: resposta em trânsito não pode reabilitar salvamento', () => {
  it('troca de tomador A→B bloqueia resposta tardia, sem invocar criação', async () => {
    let deliver;
    loansApi.simulate.mockImplementationOnce(() => new Promise((resolve) => { deliver = resolve; }));
    const user = await setupForm();
    await user.click(screen.getByRole('button', { name: 'Simular' }));
    expect(loansApi.simulate).toHaveBeenCalledTimes(1);
    await user.selectOptions(screen.getByLabelText('Tomador'), '8');
    await act(async () => { deliver(simulation('stale-ana')); });
    expect(screen.queryByRole('button', { name: 'Salvar como rascunho' })).toBeNull();
    expect(loansApi.createContract).not.toHaveBeenCalled();
  });

  it('mudança de descrição e sequência A→B→A invalida mesmo snapshot de termos', async () => {
    let deliver;
    loansApi.simulate.mockImplementationOnce(() => new Promise((resolve) => { deliver = resolve; }));
    const user = await setupForm();
    await user.click(screen.getByRole('button', { name: 'Simular' }));
    await user.selectOptions(screen.getByLabelText('Tomador'), '8');
    await user.selectOptions(screen.getByLabelText('Tomador'), '7');
    await act(async () => { deliver(simulation('stale-aba')); });
    expect(screen.queryByRole('button', { name: 'Salvar como rascunho' })).toBeNull();

    let deliverAgain;
    loansApi.simulate.mockImplementationOnce(() => new Promise((resolve) => { deliverAgain = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Simular' }));
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Ajuste');
    await act(async () => { deliverAgain(simulation('stale-description')); });
    expect(screen.queryByRole('button', { name: 'Salvar como rascunho' })).toBeNull();

    loansApi.simulate.mockResolvedValueOnce(simulation('fresh'));
    await user.selectOptions(screen.getByLabelText('Tomador'), '8');
    await user.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByRole('button', { name: 'Salvar como rascunho' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Salvar como rascunho' }));
    await waitFor(() => expect(loansApi.createContract).toHaveBeenCalledWith(
      expect.objectContaining({ borrower_id: 8, terms_hash: 'fresh', description: 'Ajuste' }),
    ));
  });
});

describe('SPEC004-R2 — F3: calendário completo do cadastro', () => {
  const base = { principal: '1.000,00', interest_method: 'fixed_addon', rate: '0',
    installment_count: '120', frequency: 'monthly',
    start_on: '01/01/9999', first_due_on: '01/02/9999', manual_dates: [] };

  it('recusa prazo mensal que ultrapassa ano 9999', () => {
    expect(buildTerms(base).error).toMatch(/calendário|limite|9999/i);
  });

  it('recusa prazos diários e quinzenais que ultrapassam 9999, mas aceita prazo viável', () => {
    expect(buildTerms({ ...base, frequency: 'every_x_days', interval_days: '365' }).error)
      .toMatch(/calendário|limite|9999/i);
    expect(buildTerms({ ...base, frequency: 'biweekly' }).error).toMatch(/calendário|limite|9999/i);
    expect(buildTerms({ ...base, installment_count: '1', first_due_on: '31/12/9999' }).terms.first_due_on)
      .toBe('9999-12-31');
  });
});
