import { toApiMoney } from './money';
import { displayDate, normalizeRate, parseCivilDate, scheduleFitsCivilCalendar, strictInteger } from './entryValidation';

// Aceita ISO estrito somente para dados de testes/integrações antigas; a UI edita DD/MM/AAAA.
function dateToApi(raw) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw ?? ''))) {
    return parseCivilDate(displayDate(raw));
  }
  return parseCivilDate(raw);
}

export function buildTerms(f) {
  const principal = toApiMoney(f.principal);
  if (!principal) return { error: 'Valor emprestado inválido.' };
  const rate = normalizeRate(f.rate);
  if (rate === null) return { error: 'Taxa inválida. Informe um percentual maior ou igual a zero.' };
  const installment_count = strictInteger(f.installment_count, 1, 120);
  if (installment_count === null) return { error: 'Parcelas: informe um inteiro entre 1 e 120.' };
  const start_on = dateToApi(f.start_on);
  if (!start_on) return { error: 'Data de início inválida (DD/MM/AAAA).' };

  const terms = {
    principal, interest_method: f.interest_method, rate, installment_count,
    frequency: f.frequency, start_on,
  };

  if (f.frequency === 'manual') {
    const raw = Array.isArray(f.manual_dates) ? f.manual_dates : [];
    const visible = raw.slice(0, installment_count);
    if (visible.length !== installment_count) return { error: 'Informe uma data para cada parcela.' };
    const manual_dates = [];
    for (let i = 0; i < visible.length; i++) {
      const date = dateToApi(visible[i]);
      if (!date) return { error: 'Parcela ' + (i + 1) + ': data inválida (DD/MM/AAAA).' };
      if (date <= (i === 0 ? start_on : manual_dates[i - 1])) {
        return { error: 'Parcela ' + (i + 1) + ': vencimentos devem ser posteriores e crescentes.' };
      }
      manual_dates.push(date);
    }
    terms.manual_dates = manual_dates;
  } else {
    const first_due_on = dateToApi(f.first_due_on);
    if (!first_due_on) return { error: 'Primeiro vencimento inválido (DD/MM/AAAA).' };
    if (first_due_on <= start_on) return { error: 'Primeiro vencimento deve ser posterior à data de início.' };
    terms.first_due_on = first_due_on;
  }

  if (f.frequency === 'every_x_days') {
    const interval_days = strictInteger(f.interval_days, 1, 365);
    if (interval_days === null) return { error: 'Intervalo (dias): informe um inteiro entre 1 e 365.' };
    terms.interval_days = interval_days;
  }
  if (f.frequency !== 'manual' && !scheduleFitsCivilCalendar(
    terms.first_due_on, installment_count, f.frequency, terms.interval_days,
  )) {
    return { error: 'Vencimentos excedem o limite do calendário (ano 9999).' };
  }
  return { terms };
}
