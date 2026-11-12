/** SPEC004: datas DD/MM/AAAA; calendário civil, sem Date.parse permissivo. */
export const digitsOnly = (raw) => String(raw ?? '').replace(/\D/g, '');

export function maskDate(raw) {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}

export function parseCivilDate(raw) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(raw ?? ''));
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 31, 30, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  return match[3] + '-' + match[2] + '-' + match[1];
}

export function displayDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

export function strictInteger(raw, min, max) {
  const value = String(raw ?? '');
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

export function normalizeRate(raw) {
  let value = String(raw ?? '').trim();
  if (/^0+(?:[.,]0+)?%$/.test(value)) return '0';
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(value)) return null;
  value = value.replace(',', '.');
  if (!Number.isFinite(Number(value))) return null;
  return Number(value) === 0 ? '0' : value;
}

export function caretForDigits(masked, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < masked.length; i++) {
    if (/\d/.test(masked[i]) && ++seen === count) return i + 1;
  }
  return masked.length;
}


// O Python date suporta anos 1..9999. Valida o ÚLTIMO vencimento sem Date.parse
// nem conversão de fuso, espelhando os intervalos de schedule.due_dates.
export function scheduleFitsCivilCalendar(firstDueIso, count, frequency, intervalDays) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(firstDueIso ?? ''));
  if (!match || !Number.isSafeInteger(count) || count < 1 || count > 120) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!parseCivilDate(match[3] + '/' + match[2] + '/' + match[1])) return false;
  if (frequency === 'monthly') {
    return year + Math.floor((month - 1 + count - 1) / 12) <= 9999;
  }
  const step = frequency === 'biweekly' ? 15
    : frequency === 'every_x_days' ? intervalDays : null;
  if (!Number.isSafeInteger(step) || step < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const daysBeforeYear = (y) => {
    const prev = y - 1;
    return prev * 365 + Math.floor(prev / 4) - Math.floor(prev / 100) + Math.floor(prev / 400);
  };
  const beforeMonth = monthDays.slice(0, month - 1).reduce((a, v) => a + v, 0);
  const firstOrdinal = daysBeforeYear(year) + beforeMonth + day - 1;
  return firstOrdinal + step * (count - 1) < daysBeforeYear(10000);
}
