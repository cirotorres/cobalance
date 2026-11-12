import { useEffect, useMemo, useRef, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, formatDate, newIdempotencyKey, todayFortaleza } from './money';
import { buildTerms } from './terms';
import FundForm from './FundForm';
import styles from './Loans.module.css';

const INITIAL = {
  borrower_id: '', description: '', principal: '', interest_method: 'fixed_addon', rate: '5',
  installment_count: '3', frequency: 'monthly', interval_days: '', start_on: todayFortaleza(), first_due_on: '', manual_dates: '',
};

function NewLoanTab({ onOpenBorrower }) {
  const [borrowers, setBorrowers] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [sim, setSim] = useState(null);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const createKey = useRef(newIdempotencyKey('contract'));

  useEffect(() => { loansApi.listBorrowers().then(setBorrowers).catch((e) => setError(apiError(e))); }, []);

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSim(null); };
  const rateLabel = useMemo(() => (form.interest_method === 'fixed_addon'
    ? 'Adicional por parcela (% do valor emprestado)' : 'Taxa efetiva mensal (%)'), [form.interest_method]);

  const simulate = async (e) => {
    e.preventDefault();
    setError(''); setCreated(null);
    const { terms, error: err } = buildTerms(form);
    if (err) { setError(err); return; }
    try {
      setSim(await loansApi.simulate(terms));
      createKey.current = newIdempotencyKey('contract');
    } catch (ex) {
      setError(apiError(ex));
    }
  };

  const save = async () => {
    if (!form.borrower_id) { setError('Selecione o tomador.'); return; }
    setBusy(true); setError('');
    try {
      const { terms } = buildTerms(form);
      const body = { ...terms, borrower_id: parseInt(form.borrower_id, 10), terms_hash: sim.terms_hash, idempotency_key: createKey.current };
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
          <select value={form.borrower_id} onChange={set('borrower_id')} required>
            <option value="">Selecione…</option>
            {borrowers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>Descrição (opcional)<input value={form.description} onChange={set('description')} maxLength={200} /></label>
        <label className={styles.field}>Valor emprestado (R$)<input inputMode="decimal" value={form.principal} onChange={set('principal')} required placeholder="3000,00" /></label>
        <label className={styles.field}>Modalidade
          <select value={form.interest_method} onChange={set('interest_method')}>
            <option value="fixed_addon">Adicional fixo por parcela</option>
            <option value="price">Tabela Price</option>
          </select>
        </label>
        <label className={styles.field}>{rateLabel}<input inputMode="decimal" value={form.rate} onChange={set('rate')} required aria-label="Taxa" /></label>
        <label className={styles.field}>Parcelas<input type="number" min="1" max="120" value={form.installment_count} onChange={set('installment_count')} required /></label>
        <label className={styles.field}>Frequência
          <select value={form.frequency} onChange={set('frequency')}>
            <option value="monthly">Mensal</option><option value="biweekly">Quinzenal (15 dias)</option>
            <option value="every_x_days">A cada X dias</option><option value="manual">Datas manuais</option>
          </select>
        </label>
        {form.frequency === 'every_x_days' && (
          <label className={styles.field}>Intervalo (dias)<input type="number" min="1" max="365" value={form.interval_days} onChange={set('interval_days')} required /></label>
        )}
        <label className={styles.field}>Data de início<input type="date" value={form.start_on} onChange={set('start_on')} required /></label>
        {form.frequency === 'manual' ? (
          <label className={styles.field}>Datas de vencimento (AAAA-MM-DD, separadas por vírgula)<input value={form.manual_dates} onChange={set('manual_dates')} required /></label>
        ) : (
          <label className={styles.field}>Primeiro vencimento<input type="date" value={form.first_due_on} onChange={set('first_due_on')} required /></label>
        )}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" className={styles.primary}>Simular</button>
      </form>

      {sim && (
        <div className={styles.card} aria-label="Resultado da simulação">
          <h3>Simulação (nada foi salvo)</h3>
          {(sim.warnings ?? []).map((w) => (
            <p key={w.code} role="alert" className={styles.warn}>
              {w.message} Primeira parcela: {formatBRL(w.first_installment)};
              última: {formatBRL(w.last_installment)}.
            </p>
          ))}
          <table className={styles.table}>
            <thead><tr><th>#</th><th>Vencimento</th><th>Principal</th><th>Juros</th><th>Parcela</th></tr></thead>
            <tbody>
              {sim.installments.map((i) => (
                <tr key={i.number}><td>{i.number}</td><td>{formatDate(i.due_on)}</td><td>{formatBRL(i.principal)}</td><td>{formatBRL(i.interest)}</td><td data-testid="sim-total">{formatBRL(i.total)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={2}>Total</td><td>{formatBRL(sim.totals.principal)}</td><td data-testid="sim-interest">{formatBRL(sim.totals.interest)}</td><td data-testid="sim-grand">{formatBRL(sim.totals.total)}</td></tr></tfoot>
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
