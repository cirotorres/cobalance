import styles from './BalancoLancamentoRow.module.css';

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function formatAmount(value) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(value));
  return value < 0 ? `- ${formatted}` : formatted;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function BalancoLancamentoRow({ item, onUncheck }) {
  return (
    <li className={styles.row}>
      <div className={styles.meta}>
        <span className={styles.desc}>{item.description}</span>
        <span className={styles.date}>{formatDate(item.transaction_date)}</span>
      </div>
      <span className={styles.amount}>{formatAmount(item.amount)}</span>
      <button
        type="button"
        className={styles.uncheckBtn}
        aria-label="Desmarcar revisão"
        title="Desmarcar revisão"
        onClick={() => onUncheck(item.id)}
      >
        <XIcon />
      </button>
    </li>
  );
}

export default BalancoLancamentoRow;
