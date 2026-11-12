import { toApiMoney } from './money';

export function buildTerms(f) {
  const principal = toApiMoney(f.principal);
  if (!principal) return { error: 'Valor emprestado inválido.' };
  const rate = String(f.rate).trim().replace(',', '.');
  const terms = {
    principal, interest_method: f.interest_method, rate, installment_count: parseInt(f.installment_count, 10),
    frequency: f.frequency, start_on: f.start_on,
  };
  if (f.frequency === 'manual') {
    terms.manual_dates = f.manual_dates.split(/[\s,;]+/).filter(Boolean);
  } else {
    terms.first_due_on = f.first_due_on || null;
  }
  if (f.frequency === 'every_x_days') terms.interval_days = parseInt(f.interval_days, 10) || null;
  return { terms };
}
