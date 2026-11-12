import { useCallback, useEffect, useRef, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, formatDate, newIdempotencyKey, sumMoney, toApiMoney, todayFortaleza } from './money';
import ReceiptDialog from './ReceiptDialog';
import ChargePanel, { ChargeView } from './ChargePanel';
import FundForm from './FundForm';
import styles from './Loans.module.css';

const STATUS = { PENDING: 'Em aberto', PARTIALLY_PAID: 'Parcial', PAID: 'Paga' };
const LOAN_STATUS = { DRAFT: 'Rascunho', ACTIVE: 'Ativo', SETTLED: 'Quitado', CANCELLED: 'Cancelado' };
const INACTIVE_NOTE = {
  DRAFT: 'Rascunho — envio não confirmado. Parcelas previstas, sem dívida exigível.',
  CANCELLED: 'Cancelado — sem obrigação financeira. Cronograma original apenas para consulta.',
  SETTLED: 'Quitado — sem saldo pendente.',
};
const INACTIVE_INSTALLMENT_STATUS = {
  DRAFT: 'Prevista — sem envio',
  CANCELLED: 'Cancelada — sem obrigação',
  SETTLED: 'Quitada',
};

function AdjustmentForm({ inst, onDone }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const key = useRef(newIdempotencyKey('adj'));
  const submit = async (e) => {
    e.preventDefault();
    const v = toApiMoney(amount);
    if (!v) { setError('Valor inválido.'); return; }
    try {
      await loansApi.createAdjustment(inst.id, { amount: v, reason, idempotency_key: key.current });
      onDone();
    } catch (err) { setError(apiError(err)); }
  };
  return (
    <form onSubmit={submit} className={styles.inlineForm} aria-label={`Acréscimo manual parcela ${inst.number}`}>
      <label className={styles.inline}>Valor do acréscimo<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <label className={styles.inline}>Motivo<input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></label>
      <button type="submit">Confirmar acréscimo</button>
      {error && <span role="alert" className={styles.error}>{error}</span>}
    </form>
  );
}

function AmortizationPanel({ loan, borrowerId, onDone }) {
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState('reduce_installment');
  const [on, setOn] = useState(todayFortaleza());
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey('amort'));

  const doPreview = async (e) => {
    e.preventDefault();
    setError(''); setPreview(null);
    const v = toApiMoney(amount);
    if (!v) { setError('Valor inválido.'); return; }
    try {
      setPreview(await loansApi.prepaymentPreview(loan.id, { amount: v, strategy, on }));
      key.current = newIdempotencyKey('amort');
    } catch (err) { setError(apiError(err)); }
  };
  const confirm = async () => {
    setBusy(true); setError('');
    try {
      await loansApi.createReceipt({ borrower_id: borrowerId, received_on: on, kind: 'price_amortization', amount: preview.amortization,
        loan_id: loan.id, strategy, idempotency_key: key.current, items: [] });
      onDone();
    } catch (err) { setError(apiError(err)); setBusy(false); }
  };
  return (
    <div className={styles.dialog} aria-label={`Amortização Price empréstimo ${loan.id}`}>
      <form onSubmit={doPreview} className={styles.inlineForm}>
        <label className={styles.inline}>Valor da amortização<input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setPreview(null); }} required /></label>
        <label className={styles.inline}>Data<input type="date" value={on} onChange={(e) => { setOn(e.target.value); setPreview(null); }} /></label>
        <fieldset className={styles.inline}>
          <legend>Recalcular</legend>
          <label><input type="radio" name={`s${loan.id}`} checked={strategy === 'reduce_installment'} onChange={() => { setStrategy('reduce_installment'); setPreview(null); }} /> Reduzir prestação (mantém prazo)</label>
          <label><input type="radio" name={`s${loan.id}`} checked={strategy === 'reduce_term'} onChange={() => { setStrategy('reduce_term'); setPreview(null); }} /> Reduzir prazo (mantém prestação)</label>
        </fieldset>
        <button type="submit">Pré-visualizar recálculo</button>
      </form>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {preview && (
        <>
          <p>Saldo de principal futuro: {formatBRL(preview.balance_before)} → {formatBRL(preview.balance_after)} (prévia, nada foi salvo)</p>
          {(preview.warnings ?? []).map((w) => (
            <p key={w.code} role="alert" className={styles.warn}>{w.message} Primeira parcela: {formatBRL(w.first_installment)}; última: {formatBRL(w.last_installment)}.</p>
          ))}
          <ul className={styles.list} aria-label="Novo cronograma">
            {preview.installments.map((i) => <li key={i.number}>{formatDate(i.due_on)} · {formatBRL(i.total)} (juros {formatBRL(i.interest)})</li>)}
          </ul>
          <button type="button" className={styles.primary} onClick={confirm} disabled={busy}>Confirmar amortização de {formatBRL(preview.amortization)}</button>
        </>
      )}
    </div>
  );
}

function BorrowerStatement({ borrowerId }) {
  const [data, setData] = useState(null);
  const [pix, setPix] = useState([]);
  const [selected, setSelected] = useState({});
  const [mode, setMode] = useState(null); // receipt | charge
  const [charge, setCharge] = useState(null);
  const [adjFor, setAdjFor] = useState(null);
  const [amortFor, setAmortFor] = useState(null);
  const [reverseFor, setReverseFor] = useState(null);
  const [cancelFor, setCancelFor] = useState(null);
  const [adjustmentReverseFor, setAdjustmentReverseFor] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    Promise.all([loansApi.statement(borrowerId), loansApi.listPix()])
      .then(([s, p]) => { if (alive) { setData(s); setPix(p); } })
      .catch((e) => alive && setError(apiError(e)));
    return () => { alive = false; };
  }, [borrowerId, tick]);

  if (!data) return error ? <p role="alert" className={styles.error}>{error}</p> : <p>Carregando ficha…</p>;

  const open = data.loans.flatMap((l) => (l.status === 'ACTIVE' ? l.installments.filter((i) => i.remaining !== '0.00') : []));
  const chosen = open.filter((i) => selected[i.id]);
  const after = async (text) => { setMode(null); setSelected({}); setAdjFor(null); setAmortFor(null); setMsg(text); await load(); };

  const cancelDraft = async () => {
    setBusyAction(true); setError('');
    try {
      await loansApi.cancel(cancelFor);
      setCancelFor(null);
      await after('Rascunho cancelado.');
    } catch (err) { setError(apiError(err)); }
    finally { setBusyAction(false); }
  };

  const reverseAdjustment = async () => {
    setBusyAction(true); setError('');
    try {
      await loansApi.reverseAdjustment(adjustmentReverseFor);
      setAdjustmentReverseFor(null);
      await after('Acréscimo estornado.');
    } catch (err) { setError(apiError(err)); }
    finally { setBusyAction(false); }
  };

  const openHistoryCharge = async (id) => {
    setHistoryBusy(id); setError('');
    try {
      const existing = await loansApi.charge(id);
      setCharge(existing);
      setMode(null);
    } catch (err) { setError(apiError(err)); }
    finally { setHistoryBusy(null); }
  };

  const reverse = async (e) => {
    e.preventDefault();
    try { await loansApi.reverseReceipt(reverseFor, reason); setReverseFor(null); setReason(''); await after('Recebimento estornado.'); }
    catch (err) { setError(apiError(err)); }
  };

  return (
    <div className={styles.stack} aria-label={`Ficha de ${data.borrower.name}`}>
      <div className={styles.card}>
        <h2>{data.borrower.name}</h2>
        <div className={styles.stats}>
          <div className={styles.stat}><span className={styles.statLabel}>Em aberto</span><strong data-testid="open-total">{formatBRL(data.open_total)}</strong></div>
          <div className={styles.stat}><span className={styles.statLabel}>Em atraso</span><strong data-testid="overdue-total">{formatBRL(data.overdue_total)}</strong></div>
        </div>
      </div>
      {msg && <p role="status" className={styles.ok}>{msg}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}

      {data.loans.map((l) => (
        <div key={l.id} className={styles.card} data-testid={`loan-${l.id}`}>
          <h3>
            Empréstimo #{l.id} · {['DRAFT', 'CANCELLED'].includes(l.status) ? 'Capital previsto: ' : ''}{formatBRL(l.principal)} · {l.interest_method === 'price' ? `Price ${l.rate}% a.m.` : `Adicional ${l.rate}% por parcela`}
            <span className={styles.badgeMuted}> {LOAN_STATUS[l.status]}</span>
            {l.current_version > 1 && <span className={styles.badgeMuted}> cronograma v{l.current_version}</span>}
          </h3>
          {INACTIVE_NOTE[l.status] && <p className={styles.muted} role="note">{INACTIVE_NOTE[l.status]}</p>}
          {l.status === 'DRAFT' && (
            <>
              <FundForm loan={l} onFunded={() => after('Envio confirmado.')} />
              {cancelFor === l.id ? (
                <div className={styles.inlineForm} role="group" aria-label="Confirmar cancelamento do rascunho">
                  <p>O rascunho será cancelado sem registrar desembolso. Confirma?</p>
                  <button type="button" className={styles.danger} disabled={busyAction} onClick={cancelDraft}>Confirmar cancelamento</button>
                  <button type="button" disabled={busyAction} onClick={() => setCancelFor(null)}>Voltar</button>
                </div>
              ) : (
                <button type="button" disabled={busyAction} onClick={() => setCancelFor(l.id)}>Cancelar rascunho</button>
              )}
            </>
          )}
          <table className={styles.table}>
            <thead><tr><th><span className={styles.srOnly}>Selecionar</span></th><th>#</th><th>Vencimento</th><th>Principal</th><th>Juros</th><th>Acréscimo</th><th>Total</th><th>{l.status === 'ACTIVE' ? 'Em aberto' : 'Saldo exigível'}</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {l.installments.map((i) => {
                const selectable = l.status === 'ACTIVE' && i.remaining !== '0.00';
                return (
                  <tr key={i.id} data-testid={`inst-${l.id}-${i.number}`}>
                    <td>{selectable && (
                      <input type="checkbox" aria-label={`Selecionar parcela ${i.number} do empréstimo ${l.id}`}
                        checked={!!selected[i.id]} onChange={(e) => setSelected({ ...selected, [i.id]: e.target.checked })} />
                    )}</td>
                    <td>{i.number}</td><td>{formatDate(i.due_on)}</td><td>{formatBRL(i.principal)}</td><td>{formatBRL(i.interest)}</td>
                    <td>{formatBRL(i.adjustment)}</td><td>{formatBRL(i.total)}</td><td>{l.status === 'ACTIVE' ? formatBRL(i.remaining) : '—'}</td>
                    <td>
                      {INACTIVE_INSTALLMENT_STATUS[l.status] ?? STATUS[i.status]}
                      {l.status === 'ACTIVE' && i.overdue && <span className={styles.badgeDanger} data-testid="overdue-badge"> Atrasada</span>}
                    </td>
                    <td>{l.status === 'ACTIVE' && i.overdue && i.status !== 'PAID' && (
                      <button type="button" onClick={() => setAdjFor(adjFor === i.id ? null : i.id)}>Acréscimo manual</button>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {l.installments.filter((i) => i.id === adjFor).map((i) => (
            <AdjustmentForm key={i.id} inst={i} onDone={() => after('Acréscimo registrado.')} />
          ))}
          {(data.adjustments ?? []).some((a) => a.loan_id === l.id) && (
            <section aria-label={`Acréscimos empréstimo ${l.id}`}>
              <h4>Acréscimos manuais</h4>
              <ul className={styles.list}>
                {data.adjustments.filter((a) => a.loan_id === l.id).map((a) => (
                  <li key={a.id} className={styles.row}>
                    <span>#{a.id} · parcela {a.installment_number} · {formatBRL(a.amount)} · {a.reason}
                      {a.reversed && <span className={styles.badgeMuted}>Estornado</span>}
                    </span>
                    {a.can_reverse
                      ? <button type="button" disabled={busyAction} onClick={() => setAdjustmentReverseFor(a.id)}>Estornar acréscimo #{a.id}</button>
                      : <span className={styles.muted}>{a.blocked_reason}</span>}
                  </li>
                ))}
              </ul>
              {data.adjustments.some((a) => a.loan_id === l.id && a.id === adjustmentReverseFor && a.can_reverse) && (
                <div className={styles.inlineForm} role="group" aria-label="Confirmar estorno de acréscimo">
                  <p>O acréscimo será retirado do saldo e permanecerá no histórico. Confirma?</p>
                  <button type="button" className={styles.danger} disabled={busyAction} onClick={reverseAdjustment}>Confirmar estorno do acréscimo</button>
                  <button type="button" disabled={busyAction} onClick={() => setAdjustmentReverseFor(null)}>Voltar</button>
                </div>
              )}
            </section>
          )}
          {l.interest_method === 'price' && l.status === 'ACTIVE' && (
            amortFor === l.id
              ? <AmortizationPanel loan={l} borrowerId={data.borrower.id} onDone={() => after('Amortização registrada e cronograma recalculado.')} />
              : <button type="button" onClick={() => setAmortFor(l.id)}>Antecipar com recálculo (Price)</button>
          )}
        </div>
      ))}

      <div className={`${styles.card} ${styles.sticky}`}>
        <p>Selecionadas: {chosen.length} · Total {formatBRL(sumMoney(chosen.map((i) => i.remaining)))}</p>
        <div className={styles.actions}>
          <button type="button" disabled={!chosen.length} onClick={() => { setMode('charge'); setCharge(null); }}>Gerar cobrança Pix</button>
          <button type="button" className={styles.primary} disabled={!chosen.length} onClick={() => setMode('receipt')}>Registrar recebimento</button>
        </div>
        {mode === 'receipt' && (
          <ReceiptDialog borrowerId={data.borrower.id} items={chosen} pixAccounts={pix} onCancel={() => setMode(null)}
            onDone={(r) => after(`Recebimento de ${formatBRL(r.amount)} confirmado (${r.allocations.length} parcela(s)).`)} />
        )}
        {mode === 'charge' && !charge && (
          <ChargePanel borrowerId={data.borrower.id} items={chosen} pixAccounts={pix} onCancel={() => setMode(null)}
            onCreated={(c) => { setCharge(c); load(); }} />
        )}
      </div>
      {charge && <ChargeView charge={charge} onShared={setCharge} onClose={() => setCharge(null)} />}

      <div className={styles.card}>
        <h3>Recebimentos</h3>
        <ul className={styles.list} aria-label="Recebimentos">
          {data.receipts.map((r) => (
            <li key={r.id} className={styles.row}>
              <span>{formatDate(r.received_on)} · {formatBRL(r.amount)} · {r.kind === 'partial' ? 'parcial' : r.kind === 'price_amortization' ? 'amortização' : 'integral'}
                {r.reversed && <span className={styles.badgeMuted}> Estornado</span>}</span>
              {!r.reversed && <button type="button" onClick={() => setReverseFor(r.id)}>Estornar</button>}
            </li>
          ))}
        </ul>
        {reverseFor && (
          <form onSubmit={reverse} className={styles.inlineForm} aria-label="Confirmar estorno">
            <label className={styles.inline}>Motivo do estorno<input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></label>
            <button type="submit" className={styles.danger}>Confirmar estorno</button>
            <button type="button" onClick={() => setReverseFor(null)}>Cancelar</button>
          </form>
        )}
      </div>
      {data.charges.length > 0 && (
        <div className={styles.card}>
          <h3>Cobranças geradas</h3>
          <ul className={styles.list}>
            {data.charges.map((c) => (
              <li key={c.id} className={styles.row}>
                <span>#{c.id} · {formatBRL(c.total)} · {c.status === 'SHARED' ? 'compartilhada' : 'gerada'} · não confirma pagamento</span>
                <button type="button" disabled={historyBusy !== null} onClick={() => openHistoryCharge(c.id)}>
                  {historyBusy === c.id ? 'Carregando cobrança…' : `Abrir cobrança #${c.id}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default BorrowerStatement;
