import { useEffect, useMemo, useRef, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, formatDate, newIdempotencyKey, todayFortaleza } from './money';
import { buildTerms } from './terms';
import { displayDate, strictInteger } from './entryValidation';
import DateField from './DateField';
import FundForm from './FundForm';
import styles from './Loans.module.css';

const INITIAL = {
  borrower_id: '', description: '', principal: '', interest_method: 'fixed_addon', rate: '5',
  installment_count: '3', frequency: 'monthly', interval_days: '', start_on: displayDate(todayFortaleza()), first_due_on: '', manual_dates: [],
};

function NewLoanTab({ onOpenBorrower }) {
  const [borrowers, setBorrowers] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [sim, setSim] = useState(null);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const createKey = useRef(newIdempotencyKey('contract'));
  const formGeneration = useRef(0);

  useEffect(() => { loansApi.listBorrowers().then(setBorrowers).catch((e) => setError(apiError(e))); }, []);

  const change = (patch) => {
    // Monotônico inclusive para A→B→A: descarta respostas de simulação antigas.
    formGeneration.current += 1;
    setForm((old) => ({ ...old, ...patch }));
    setSim(null);
    setError('');
  };
  const changeDigits = (k, event) => {
    const value = event.target.value;
    if (!/^\d*$/.test(value)) {
      setError(k === 'installment_count' ? 'Parcelas aceita apenas algarismos.' : 'Intervalo aceita apenas algarismos.');
      return;
    }
    change({ [k]: value });
  };
  const changeManual = (n, value) => {
    const next = [...form.manual_dates];
    next[n] = value;
    change({ manual_dates: next });
  };
  const visibleManualCount = strictInteger(form.installment_count, 1, 120) || 0;
  // O snapshot inclui o formulário INTEIRO: tomador, descrição e datas.
  // A geração, verificada no retorno da rede, impede inclusive o ciclo A→B→A.
  const readySim = sim && sim._formSnapshot === JSON.stringify(form) ? sim : null;
  const rateLabel = useMemo(() => (form.interest_method === 'fixed_addon'
    ? 'Adicional por parcela (% do valor emprestado)' : 'Taxa efetiva mensal (%)'), [form.interest_method]);

  const simulate = async (e) => {
    e.preventDefault();
    const generation = ++formGeneration.current;
    setError(''); setCreated(null);
    const { terms, error: err } = buildTerms(form);
    if (err) { setError(err); return; }
    const formSnapshot = JSON.stringify(form);
    try {
      const result = await loansApi.simulate(terms);
      if (generation !== formGeneration.current) return;
      setSim({ ...result, _formSnapshot: formSnapshot });
      createKey.current = newIdempotencyKey('contract');
    } catch (ex) {
      if (generation === formGeneration.current) setError(apiError(ex));
    }
  };

  const save = async () => {
    if (!form.borrower_id) { setError('Selecione o tomador.'); return; }
    setBusy(true); setError('');
    try {
      const { terms, error: validationError } = buildTerms(form);
      if (validationError || !readySim) { setError(validationError || 'Simule novamente.'); return; }
      const body = { ...terms, borrower_id: Number(form.borrower_id), terms_hash: readySim.terms_hash, idempotency_key: createKey.current };
      if (form.description) body.description = form.description;
      setCreated(await loansApi.createContract(body));
    } catch (ex) {
      setError(apiError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <form onSubmit={simulate} className={`${styles.card} ${styles.formGrid}`} aria-label="Simular empréstimo">
        <label className={styles.field}>Tomador
          <select value={form.borrower_id} onChange={(e) => change({ borrower_id: e.target.value })} required>
            <option value="">Selecione…</option>
            {borrowers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>Descrição (opcional)<input value={form.description} onChange={(e) => change({ description: e.target.value })} maxLength={200} /></label>
        <label className={styles.field}>Valor emprestado (R$)<input inputMode="decimal" value={form.principal} onChange={(e) => change({ principal: e.target.value })} required placeholder="3000,00" /></label>
        <label className={styles.field}>Modalidade
          <select value={form.interest_method} onChange={(e) => change({ interest_method: e.target.value })}>
            <option value="fixed_addon">Adicional fixo por parcela</option>
            <option value="price">Tabela Price</option>
          </select>
        </label>
        <div className={styles.field}>
          <button type="button" className={styles.zeroRate} aria-pressed={form.rate === '0' && form.interest_method === 'fixed_addon'}
            onClick={() => change({ interest_method: 'fixed_addon', rate: '0' })}>Sem juros</button>
          <label>{rateLabel}<input inputMode="decimal" value={form.rate} onChange={(e) => change({ rate: e.target.value })} required aria-label="Taxa" /></label>
        </div>
        <label className={styles.field}>Parcelas<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3}
          value={form.installment_count} onChange={(e) => changeDigits('installment_count', e)} required /></label>
        <label className={styles.field}>Frequência
          <select value={form.frequency} onChange={(e) => change({ frequency: e.target.value })}>
            <option value="monthly">Mensal</option><option value="biweekly">Quinzenal (15 dias)</option>
            <option value="every_x_days">A cada X dias</option><option value="manual">Datas manuais</option>
          </select>
        </label>
        {form.frequency === 'every_x_days' && (
          <label className={styles.field}>Intervalo (dias)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3}
            value={form.interval_days} onChange={(e) => changeDigits('interval_days', e)} required /></label>
        )}
        <DateField label="Data de início" value={form.start_on} onChange={(value) => change({ start_on: value })} />
        {form.frequency === 'manual' ? (
          <fieldset className={styles.manualDates}>
            <legend>Vencimentos de cada parcela</legend>
            {Array.from({ length: visibleManualCount }, (_, i) => (
              <DateField key={i} label={'Parcela ' + (i + 1)} value={form.manual_dates[i] || ''} onChange={(value) => changeManual(i, value)} />
            ))}
          </fieldset>
        ) : (
          <DateField label="Primeiro vencimento" value={form.first_due_on} onChange={(value) => change({ first_due_on: value })} />
        )}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" className={styles.primary}>Simular</button>
      </form>

      {readySim && (
        <div className={styles.card} aria-label="Resultado da simulação">
          <h3>Simulação (nada foi salvo)</h3>
          {(readySim.warnings ?? []).map((w) => (
            <p key={w.code} role="alert" className={styles.warn}>
              {w.message} Primeira parcela: {formatBRL(w.first_installment)};
              última: {formatBRL(w.last_installment)}.
            </p>
          ))}
          <table className={styles.table}>
            <thead><tr><th>#</th><th>Vencimento</th><th>Principal</th><th>Juros</th><th>Parcela</th></tr></thead>
            <tbody>
              {readySim.installments.map((i) => (
                <tr key={i.number}><td>{i.number}</td><td>{formatDate(i.due_on)}</td><td>{formatBRL(i.principal)}</td><td>{formatBRL(i.interest)}</td><td data-testid="sim-total">{formatBRL(i.total)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={2}>Total</td><td>{formatBRL(readySim.totals.principal)}</td><td data-testid="sim-interest">{formatBRL(readySim.totals.interest)}</td><td data-testid="sim-grand">{formatBRL(readySim.totals.total)}</td></tr></tfoot>
          </table>
          {!created && <button type="button" className={styles.primary} onClick={save} disabled={busy}>Salvar como rascunho</button>}
        </div>
      )}

      {created && (
        <div className={styles.card}>
          <h3>Empréstimo #{created.id} — {created.status === 'DRAFT' ? 'rascunho' : created.status}</h3>
          {created.status === 'DRAFT' ? (
            <FundForm loan={created} onFunded={setCreated} />
          ) : (
            <>
              <p role="status" className={styles.ok}>Envio confirmado em {formatDate(created.funded_on)}. Empréstimo ativo.</p>
              <button type="button" onClick={() => onOpenBorrower(created.borrower_id)}>Abrir ficha do tomador</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default NewLoanTab;
