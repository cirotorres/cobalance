import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/loansService', () => {
  const loansApi = {
    listBorrowers: vi.fn(), createBorrower: vi.fn(), simulate: vi.fn(), createContract: vi.fn(),
    statement: vi.fn(), listPix: vi.fn(), cancel: vi.fn(), void: vi.fn(),
  };
  return { loansApi, apiError: (e) => e?.message || 'erro' };
});

import { loansApi } from '../../services/loansService';
import NewLoanTab from './NewLoanTab';
import BorrowersTab from './BorrowersTab';
import BorrowerStatement from './BorrowerStatement';

const borrower = { id: 7, name: 'Ana de nome muito comprido com vários sobrenomes' };
const inst = { id: 101, loan_id: 11, number: 1, due_on: '2026-12-10', principal: '333.34',
  interest: '0.00', adjustment: '0.00', total: '333.34', remaining: '333.34', status: 'PENDING', overdue: false };
const loan = (status = 'ACTIVE') => ({ id: 11, borrower_id: 7, principal: '1000.00',
  interest_method: 'fixed_addon', rate: '0', status, current_version: 1, installments: [inst] });
const statement = (status = 'ACTIVE') => ({
  borrower, open_total: status === 'ACTIVE' ? '333.34' : '0.00', overdue_total: '0.00',
  loans: [loan(status)], receipts: [], charges: [], adjustments: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  loansApi.listBorrowers.mockResolvedValue([borrower, { id: 8, name: 'Breno' }]);
  loansApi.listPix.mockResolvedValue([]);
  loansApi.statement.mockResolvedValue(statement());
});

describe('SPEC004 — novo empréstimo e tomadores mobile', () => {
  it('sem juros pode ser escolhido explicitamente e campos usam teclado numérico com DD/MM/AAAA', async () => {
    render(<NewLoanTab onOpenBorrower={() => {}} />);
    await screen.findByRole('option', { name: borrower.name });
    await userEvent.click(screen.getByRole('button', { name: 'Sem juros' }));
    expect(screen.getByLabelText('Taxa')).toHaveValue('0');
    expect(screen.getByLabelText('Parcelas')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('Parcelas')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Data de início')).toHaveAttribute('placeholder', 'DD/MM/AAAA');
    expect(screen.getByLabelText('Data de início')).toHaveAttribute('inputmode', 'numeric');
  });
  it('manual apresenta campo por parcela e altera quantidade sem perder primeiras datas', async () => {
    render(<NewLoanTab onOpenBorrower={() => {}} />);
    await screen.findByRole('option', { name: borrower.name });
    await userEvent.selectOptions(screen.getByLabelText('Frequência'), 'manual');
    expect(screen.getByLabelText('Parcela 1')).toBeVisible();
    expect(screen.getByLabelText('Parcela 3')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Parcela 1'), '10122026');
    expect(screen.getByLabelText('Parcela 1')).toHaveValue('10/12/2026');
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '4');
    expect(screen.getByLabelText('Parcela 1')).toHaveValue('10/12/2026');
    expect(screen.getByLabelText('Parcela 4')).toBeVisible();
  });
  it('pastilhas são botões acessíveis com seleção marcada por ARIA e alternância de tomador', async () => {
    loansApi.statement.mockImplementation((id) => Promise.resolve({
      ...statement(), borrower: { id, name: id === 7 ? borrower.name : 'Breno' },
    }));
    render(<BorrowersTab />);
    const first = await screen.findByRole('button', { name: borrower.name });
    const second = screen.getByRole('button', { name: 'Breno' });
    expect(first).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await screen.findByLabelText('Ficha de ' + borrower.name);
    await userEvent.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(loansApi.statement).toHaveBeenCalledWith(8, false));
  });
});

describe('SPEC004 — anulação na ficha', () => {
  it('ACTIVE exige motivo, confirmação de não transferência e dupla confirmação; histórico consultável', async () => {
    loansApi.statement.mockResolvedValueOnce(statement()).mockResolvedValueOnce({
      ...statement('VOIDED'), loans: [],
    });
    loansApi.void.mockResolvedValue({ ...loan(), status: 'VOIDED' });
    render(<BorrowerStatement borrowerId={7} />);
    const btn = await screen.findByRole('button', { name: /Excluir empréstimo #11/ });
    await userEvent.click(btn);
    const group = screen.getByRole('group', { name: 'Anular registro do empréstimo 11' });
    expect(within(group).getByText(/Esta ação não registra pagamento nem devolução/)).toBeVisible();
    expect(loansApi.void).not.toHaveBeenCalled();
    await userEvent.type(within(group).getByLabelText('Motivo da anulação'), 'Cadastro duplicado');
    await userEvent.click(within(group).getByLabelText(/dinheiro não foi realmente transferido/));
    await userEvent.click(within(group).getByLabelText('Confirmo que desejo anular este registro'));
    await userEvent.click(within(group).getByRole('button', { name: 'Confirmar anulação' }));
    await waitFor(() => expect(loansApi.void).toHaveBeenCalledWith(11, expect.objectContaining({
      reason: 'Cadastro duplicado', confirm_no_transfer: true,
    })));
    await screen.findByRole('status');
    expect(screen.queryByTestId('loan-11')).toBeNull();
  });
  it('CANCELLED não oferece cobrança, mantém consulta de anulação histórica', async () => {
    loansApi.statement.mockResolvedValue(statement('VOIDED'));
    render(<BorrowerStatement borrowerId={7} />);
    await screen.findByRole('heading', { name: borrower.name });
    expect(screen.getByRole('button', { name: 'Mostrar anulados' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar anulados' }));
    await waitFor(() => expect(loansApi.statement).toHaveBeenCalledWith(7, true));
    const card = await screen.findByTestId('loan-11');
    expect(card).toHaveTextContent('Anulado — registro desconsiderado');
    expect(within(card).queryByRole('checkbox')).toBeNull();
    expect(within(card).queryByRole('button', { name: /Excluir empréstimo/ })).toBeNull();
  });
});
