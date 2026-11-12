// Utilitários de EXIBIÇÃO. A fonte de verdade financeira é o backend.
// Nada de float: valores tratados como string decimal / centavos inteiros.

export function toCents(str) {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(str ?? '').trim());
  if (!m) return null;
  const cents = parseInt(m[2], 10) * 100 + parseInt((m[3] || '0').padEnd(2, '0'), 10);
  return m[1] ? -cents : cents;
}

export function centsToApi(cents) {
  const sign = cents < 0 ? '-' : '';
  const c = Math.abs(cents);
  return `${sign}${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

export function formatBRL(value) {
  const cents = typeof value === 'number' ? value : toCents(value);
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const c = Math.abs(cents);
  const whole = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${whole},${String(c % 100).padStart(2, '0')}`;
}

// Aceita "3000", "3.000,50", "3000,5", "3000.50" → "3000.50" ou null.
export function toApiMoney(input) {
  let s = String(input ?? '').trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  return centsToApi(toCents(s));
}

export function sumMoney(values) {
  return centsToApi(values.reduce((acc, v) => acc + (toCents(v) || 0), 0));
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function todayFortaleza(now = new Date()) {
  // data civil em America/Fortaleza (UTC-3, sem horário de verão)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(now);
}

export function newIdempotencyKey(prefix = 'ui') {
  const rnd = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return `${prefix}-${rnd}`;
}
