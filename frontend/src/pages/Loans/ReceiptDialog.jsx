import { useRef, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, formatDate, newIdempotencyKey, sumMoney, toApiMoney, todayFortaleza } from './money';
import styles from './Loans.module.css';

/** Confirmação HUMANA de recebimento. Integral por padrão; parcial só por exceção explícita. */
function ReceiptDialog({ borrowerId, items, pixAccounts, onDone, onCancel }) {
  const [receivedOn, setReceivedOn] = useState(todayFortaleza());
  const [method, setMethod] = useState('pix');
  const [pixId, setPixId] = useState('');
  const [partial, setPartial] = useState(false);
  const [amounts, setAmounts] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey('receipt'));

  const partialValues = items.map((i) => toApiMoney(amounts[i.id] || ''));
  const total = partial ? (partialValues.every(Boolean) ? sumMoney(partialValues) : null) : sumMoney(items.map((i) => i.remaining));

  const submit = async (e) => {
    e.preventDefault();
    if (!total) { setError('Informe valores válidos para cada parcela.'); return; }
    setBusy(true); setError('');
    try {
      const body = {
        borrower_id: borrowerId, received_on: receivedOn, kind: partial ? 'partial' : 'full', amount: total, method,
        idempotency_key: key.current,
        items: items.map((i, idx) => (partial ? { installment_id: i.id, amount: partialValues[idx] } : { installment_id: i.id })),
      };
      if (pixId) body.pix_account_id = parseInt(pixId, 10);
      onDone(await loansApi.createReceipt(body));
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  };

  return (
    <form className={styles.dialog} onSubmit={submit} aria-label="Confirmar recebimento">
      <h3>Confirmar recebimento</h3>
      <ul className={styles.list}>
        {items.map((i) => (
          <li key={i.id}>
            Empréstimo #{i.loan_id} · parcela {i.number} · venc. {formatDate(i.due_on)} · em aberto {formatBRL(i.remaining)}
            {partial && (
              <label className={styles.inline}>
                Valor recebido
                <input inputMode="decimal" aria-label={`Valor parcial parcela ${i.number} empréstimo ${i.loan_id}`}
                  value={amounts[i.id] || ''} onChange={(e) => setAmounts({ ...amounts, [i.id]: e.target.value })} />
              </label>
            )}
          </li>
        ))}
      </ul>
      <label className={styles.field}>Data do recebimento<input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} required /></label>
      <label className={styles.field}>Meio
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="pix">Pix</option><option value="ted">TED</option><option value="cash">Dinheiro</option><option value="other">Outro</option>
        </select>
      </label>
      {method === 'pix' && pixAccounts.length > 0 && (
        <label className={styles.field}>Conta que recebeu (opcional)
          <select value={pixId} onChange={(e) => setPixId(e.target.value)}>
            <option value="">Não informar</option>
            {pixAccounts.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}
      <label className={styles.checkbox}>
        <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
        Pagamento parcial (exceção)
      </label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button type="submit" className={styles.primary} disabled={busy || !total}>
          Confirmar recebimento de {total ? formatBRL(total) : '—'}
        </button>
      </div>
    </form>
  );
}

export default ReceiptDialog;
