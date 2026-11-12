import { useEffect, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import { formatBRL, formatDate, todayFortaleza } from './money';
import styles from './Loans.module.css';

function Stat({ label, value, testId }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <strong data-testid={testId}>{formatBRL(value)}</strong>
    </div>
  );
}

function BalanceTab() {
  const [month, setMonth] = useState(todayFortaleza().slice(0, 7));
  const [dash, setDash] = useState(null);
  const [rep, setRep] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loansApi.dashboard().then(setDash).catch((e) => setError(apiError(e)));
  }, []);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    loansApi.monthly(month).then(setRep).catch((e) => setError(apiError(e)));
  }, [month]);

  return (
    <div className={styles.stack}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {dash && (
        <div className={styles.card}>
          <h3>Carteira atual</h3>
          <div className={styles.stats}>
            <Stat label="Principal a recuperar" value={dash.principal_outstanding} testId="dash-principal" />
            <Stat label="Juros futuros previstos" value={dash.interest_future} testId="dash-interest" />
            <Stat label="Ajustes em aberto" value={dash.adjustments_open} />
            <Stat label="Total a receber" value={dash.total_receivable} testId="dash-total" />
            <Stat label={`Em atraso (${dash.overdue_count})`} value={dash.overdue_amount} testId="dash-overdue" />
          </div>
        </div>
      )}
      <div className={styles.card}>
        <label className={styles.field}>
          Mês do relatório
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês do relatório" />
        </label>
        {rep && (
          <div className={styles.grid2}>
            <div>
              <h3>Realizado (por data de recebimento/envio)</h3>
              <div className={styles.stats}>
                <Stat label="Desembolsado" value={rep.realized.disbursed} testId="rep-disbursed" />
                <Stat label="Recebido (bruto)" value={rep.realized.received_total} testId="rep-received" />
                <Stat label="Principal recuperado" value={rep.realized.principal_recovered} testId="rep-principal" />
                <Stat label="Juros recebidos" value={rep.realized.interest_received} testId="rep-interest" />
                <Stat label="Acréscimos recebidos" value={rep.realized.adjustments_received} />
                <Stat label="Fluxo de caixa líquido" value={rep.realized.net_cashflow} testId="rep-net" />
              </div>
              <p className={styles.muted}>Recebimento bruto não é lucro: o resultado de juros aparece separado.</p>
            </div>
            <div>
              <h3>Previsto (por vencimento)</h3>
              <div className={styles.stats}>
                <Stat label="Programado" value={rep.expected.scheduled_total} testId="rep-scheduled" />
                <Stat label="Já pago" value={rep.expected.already_paid} />
                <Stat label="Em aberto vencido" value={rep.expected.overdue_open} testId="rep-overdue" />
                <Stat label="A vencer" value={rep.expected.upcoming_open} />
              </div>
              <ul className={styles.list}>
                {rep.expected.installments.map((i) => (
                  <li key={i.id}>
                    {formatDate(i.due_on)} · Empréstimo #{i.loan_id} parc. {i.number} · {formatBRL(i.total)} · {i.status}
                    {i.overdue && <span className={styles.badgeDanger}> Atrasada</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BalanceTab;
