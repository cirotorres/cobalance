import { describe, expect, it } from 'vitest';
import { buildTerms } from './terms';

const base = { principal: '3.000,00', interest_method: 'fixed_addon', rate: '5', installment_count: '3', frequency: 'monthly',
  interval_days: '', start_on: '2026-11-09', first_due_on: '2026-12-10', manual_dates: '' };

describe('buildTerms', () => {
  it('monta termos com dinheiro em string', () => {
    expect(buildTerms(base).terms).toEqual({ principal: '3000.00', interest_method: 'fixed_addon', rate: '5', installment_count: 3,
      frequency: 'monthly', start_on: '2026-11-09', first_due_on: '2026-12-10' });
  });
  it('datas manuais e intervalo', () => {
    expect(buildTerms({ ...base, frequency: 'manual', manual_dates: ['01/12/2026', '05/01/2027', '10/02/2027'] }).terms.manual_dates).toEqual(['2026-12-01', '2027-01-05', '2027-02-10']);
    expect(buildTerms({ ...base, frequency: 'every_x_days', interval_days: '10' }).terms.interval_days).toBe(10);
  });
  it('rejeita valor inválido', () => {
    expect(buildTerms({ ...base, principal: 'abc' }).error).toBeTruthy();
  });
});
