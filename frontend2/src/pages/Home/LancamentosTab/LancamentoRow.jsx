import  { useState } from 'react';
import styles from './LancamentoRow.module.css';


function EditIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

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

const SOURCE_LABEL = {
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  pix: 'Pix',
  extrato: 'Extrato (CSV)',
};

function formatAmount(value) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(value));
  return value < 0 ? `- ${formatted}` : formatted;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function LancamentoRow({ item, index, participants, participantColors = {} }) {
  const [expanded, setExpanded] = useState(false);
  const isOutflow = item.amount < 0;

  const participant = participants.find(
    (p) => p.id === item.participant_id
  )

  const hasInstallments = item.installment_total > 1;
  const sourceLabel = SOURCE_LABEL[item.source] || item.source;
  const panelId = `lanc-panel-${item.id}`;

  const stop = (e) => e.stopPropagation();

  const participantColor = participant ? participantColors[participant.id] : null;
  const rowStyle = { '--i': index };
  if (participantColor) {
    rowStyle.backgroundColor = hexToRgba(participantColor, 0.30);
  }

  return (
    <li className={styles.row} style={rowStyle}>
      <div
        type="button"
        className={`${styles.summary} ${expanded ? styles.summaryOpen : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className={styles.left}>
          <span
            className={`${styles.badge} ${isOutflow ? styles.badgeOut : styles.badgeIn}`}
          >
            {participant ? participant.name : '—'}
          </span>
          <div className={styles.meta}>
            <span className={styles.desc}>{item.description}</span>
            <span className={styles.date}>{formatDate(item.transaction_date)}</span>
          </div>
        </div>

        <div className={styles.right}>
          <span
            className={`${styles.amount} ${isOutflow ? styles.amountOut : styles.amountIn}`}
          >
            {formatAmount(item.amount)}
          </span>

          <div className={styles.actions} onClick={stop}>
            <span
              className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
              aria-hidden="true"
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronIcon />
            </span>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Editar"
              onClick={(e) => {
                stop(e);
                console.log('edit', item.id);
              }}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.danger}`}
              aria-label="Excluir"
              onClick={(e) => {
                stop(e);
                console.log('delete', item.id);
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>

      <div
        id={panelId}
        className={`${styles.panel} ${expanded ? styles.panelOpen : ''}`}
        role="region"
      >
        <div className={styles.panelInner}>
          <dl className={styles.details}>
            <div className={styles.detail}>
              <dt>Fonte</dt>
              <dd>{sourceLabel}</dd>
            </div>
            {hasInstallments && (
              <div className={styles.detail}>
                <dt>Parcela</dt>
                <dd>
                  {item.installment_number} de {item.installment_total}
                </dd>
              </div>
            )}
            <div className={styles.detail}>
              <dt>Revisado</dt>
              <dd>{item.is_reviewed ? 'Sim' : 'Não'}</dd>
            </div>
            <div className={styles.detail}>
              <dt>Criado em</dt>
              <dd>{formatDateTime(item.created_at)}</dd>
            </div>
            <div className={styles.detail}>
              <dt>Atualizado em</dt>
              <dd>{formatDateTime(item.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </li>
  );
}

export default LancamentoRow;
