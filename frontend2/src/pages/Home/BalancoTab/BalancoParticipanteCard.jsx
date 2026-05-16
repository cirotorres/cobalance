import { useState } from 'react';
import BalancoLancamentoRow from './BalancoLancamentoRow';
import styles from './BalancoParticipanteCard.module.css';

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

function BalancoParticipanteCard({
  index,
  participant,
  color,
  items,
  onToggleReview,
}) {
  const [expanded, setExpanded] = useState(false);
  const total = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  const panelId = `balanco-panel-${participant.id}`;

  const handleUncheck = (id) => {
    if (onToggleReview) onToggleReview(id, false);
    // mock — futura chamada à API de update
    console.log('uncheck from balanco', id);
  };

  const handleExport = () => {
    // mock — futura geração de CSV/PDF pelo back
    console.log('export balanco', {
      participant_id: participant.id,
      participant_name: participant.name,
      total,
      items,
    });
  };

  return (
    <li className={styles.card} style={{ '--i': index }}>
      <div
        className={`${styles.header} ${expanded ? styles.headerOpen : ''}`}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className={styles.left}>
          <span
            className={styles.swatch}
            style={{ background: color || 'var(--color-surface-alt)' }}
            aria-hidden="true"
          />
          <span className={styles.name}>{participant.name}</span>
        </div>

        <div className={styles.right}>
          <span className={styles.total}>{formatAmount(total)}</span>
          <span
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            aria-hidden="true"
          >
            <ChevronIcon />
          </span>
        </div>
      </div>

      <div
        id={panelId}
        className={`${styles.panel} ${expanded ? styles.panelOpen : ''}`}
        role="region"
      >
        <div className={styles.panelInner}>
          <ul className={styles.list}>
            {items.map((it) => (
              <BalancoLancamentoRow
                key={it.id}
                item={it}
                onUncheck={handleUncheck}
              />
            ))}
          </ul>

          <div className={styles.footer}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{formatAmount(total)}</span>
            </div>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
            >
              <DownloadIcon />
              <span>Exportar (CSV)</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default BalancoParticipanteCard;
