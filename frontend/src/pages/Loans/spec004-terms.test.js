import { describe, it, expect } from 'vitest';
import { buildTerms } from './terms';
import { maskDate, parseCivilDate, digitsOnly, normalizeRate } from './entryValidation';

const valid = {
  principal: '1.000,00', borrower_id: '1', interest_method: 'fixed_addon',
  rate: '0,0', installment_count: '3', frequency: 'monthly', interval_days: '',
  start_on: '09/11/2026', first_due_on: '10/12/2026', manual_dates: [],
};

describe('SPEC004 — datas, inteiros e juros zero RED→GREEN', () => {
  it('máscara aceita colar, backspace e limita a 8 dígitos', () => {
    expect(maskDate('09112026')).toBe('09/11/2026');
    expect(maskDate('09/11/2026')).toBe('09/11/2026');
    expect(maskDate('09112')).toBe('09/11/2');
    expect(maskDate('09/1')).toBe('09/1');
    expect(maskDate('0911202699')).toBe('09/11/2026');
  });
  it('calendário civil verdadeiro, bissexto e ISO', () => {
    expect(parseCivilDate('29/02/2028')).toBe('2028-02-29');
    for (const bad of ['31/02/2027', '29/02/2027', '01/13/2027', '00/11/2026', '09/11/0000', '9/11/2026', '01/01/10000']) {
      expect(parseCivilDate(bad)).toBeNull();
    }
  });
  it('inteiros são apenas dígitos e não aceitam exponente/sinais/frações', () => {
    expect(digitsOnly('12e+3')).toBe('123');
    for (const n of ['3abc', '2.5', '1e2', '-5', '0', '121', '']) {
      expect(buildTerms({ ...valid, installment_count: n }).error).toBeTruthy();
    }
    for (const n of ['2.5', '1e2', '-3', '0', '366']) {
      expect(buildTerms({ ...valid, frequency: 'every_x_days', interval_days: n }).error).toBeTruthy();
    }
  });
  it('converte datas DD/MM/AAAA para ISO apenas na fronteira, sem aceitar começo >= vencimento', () => {
    expect(buildTerms(valid).terms).toMatchObject({
      rate: '0', installment_count: 3, start_on: '2026-11-09', first_due_on: '2026-12-10',
    });
    expect(buildTerms({ ...valid, first_due_on: '09/11/2026' }).error).toBeTruthy();
    expect(buildTerms({ ...valid, start_on: '31/02/2026' }).error).toMatch(/Data de início/);
  });
  it('datas manuais exatamente N crescentes, não perde campo em alterações de N', () => {
    const manual = { ...valid, frequency: 'manual', manual_dates: ['10/12/2026', '20/12/2026', '10/01/2027'] };
    expect(buildTerms(manual).terms.manual_dates).toEqual(['2026-12-10', '2026-12-20', '2027-01-10']);
    expect(buildTerms({ ...manual, manual_dates: ['10/12/2026', '20/12/2026'] }).error).toBeTruthy();
    expect(buildTerms({ ...manual, manual_dates: ['10/12/2026', '09/12/2026', '10/01/2027'] }).error).toBeTruthy();
  });
  it('aceita taxa zero escrita ou colada e não normaliza negativa para zero', () => {
    expect(normalizeRate('0')).toBe('0');
    expect(normalizeRate('0,0')).toBe('0');
    expect(normalizeRate('0%')).toBe('0');
    expect(buildTerms({ ...valid, rate: '0%' }).terms.rate).toBe('0');
    expect(buildTerms({ ...valid, rate: '-1' }).error).toBeTruthy();
    expect(buildTerms({ ...valid, rate: 'abc' }).error).toBeTruthy();
  });
});
