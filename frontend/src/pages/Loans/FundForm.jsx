import { useRef, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, newIdempotencyKey, todayFortaleza } from './money';
import styles from './Loans.module.css';

function FundForm({ loan, onFunded }) {
  const [fundedOn, setFundedOn] = useState(todayFortaleza());
  const [method, setMethod] = useState('pix');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = useRef(newIdempotencyKey('fund'));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const body = { funded_on: fundedOn, method, idempotency_key: key.current };
      if (source) body.source = source;
      onFunded(await loansApi.fund(loan.id, body));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={styles.formGrid} aria-label={`Confirmar envio do empréstimo ${loan.id}`}>
      <p className={styles.muted}>O empréstimo só entra no balanço depois que você confirmar que o dinheiro foi enviado.</p>
      <label className={styles.field}>Data do envio<input type="date" value={fundedOn} onChange={(e) => setFundedOn(e.target.value)} required /></label>
      <label className={styles.field}>Forma de envio
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="pix">Pix</option><option value="ted">TED</option><option value="cash">Dinheiro</option><option value="other">Outro</option>
        </select>
      </label>
      <label className={styles.field}>Conta de origem (opcional)<input value={source} onChange={(e) => setSource(e.target.value)} /></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button type="submit" className={styles.primary} disabled={busy}>Confirmar envio de {formatBRL(loan.principal)}</button>
    </form>
  );
}


export default FundForm;
