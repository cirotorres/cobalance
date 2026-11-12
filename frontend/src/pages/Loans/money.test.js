import { describe, expect, it } from 'vitest';
import { formatBRL, sumMoney, toApiMoney, toCents, centsToApi, todayFortaleza } from './money';

describe('money (exibição, sem float)', () => {
  it('converte string decimal em centavos', () => {
    expect(toCents('1150.00')).toBe(115000);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('abc')).toBeNull();
  });
  it('formata BRL', () => {
    expect(formatBRL('3450.00')).toBe('R$ 3.450,00');
    expect(formatBRL('0.01')).toBe('R$ 0,01');
    expect(formatBRL('-3000.00')).toBe('-R$ 3.000,00');
    expect(formatBRL('1234567.89')).toBe('R$ 1.234.567,89');
  });
  it('normaliza entrada brasileira para API', () => {
    expect(toApiMoney('3.000,50')).toBe('3000.50');
    expect(toApiMoney('3000')).toBe('3000.00');
    expect(toApiMoney('R$ 1150,5')).toBe('1150.50');
    expect(toApiMoney('1,234')).toBeNull();
    expect(toApiMoney('-1')).toBeNull();
    expect(toApiMoney('')).toBeNull();
  });
  it('soma exata em centavos (0.1+0.2)', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(sumMoney(['1150.00', '300.00'])).toBe('1450.00');
    expect(centsToApi(5)).toBe('0.05');
  });
  it('data civil em America/Fortaleza', () => {
    // 2026-11-10T02:30Z = 09/11 23:30 em Fortaleza
    expect(todayFortaleza(new Date('2026-11-10T02:30:00Z'))).toBe('2026-11-09');
  });
});
