import  { useEffect, useRef, useState } from 'react';
import styles from './LancamentoRow.module.css';
import { editFinances, deleteFinance } from '../../../services/financialService'


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

function CheckCircleIcon() {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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

function LancamentoRow({ 
    item, 
    index, 
    participants, 
    participantColors = {}, 
    variant = 'lancamento', 
    updateFinanceInState, 
    removeFinanceInState, 
    updateExtratoInState 
  }) {
  const [expanded, setExpanded] = useState(false);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [isReviewed, setIsReviewed] = useState(!!item.is_reviewed);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(item.description);
  const [savingDescription, setSavingDescription] = useState(false);
  const [editingFull, setEditingFull] = useState(false);
  const [fullDraft, setFullDraft] = useState({
    description: item.description,
    amount: String(item.amount),
    transaction_date: item.transaction_date,
  });
  const [savingFull, setSavingFull] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const actionsRef = useRef(null);
  const leftRef = useRef(null);
  const isOutflow = item.participant_id === null;
  const isExtrato = variant === 'extrato';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReviewed(!!item.is_reviewed);
  }, [item.is_reviewed]);

  const participant = participants.find(
    (p) => p.id === item.participant_id
  )

  const hasInstallments = item.installment_total > 1;
  const sourceLabel = SOURCE_LABEL[item.source] || item.source;
  const panelId = `lanc-panel-${item.id}`;

  const stop = (e) => e.stopPropagation();

  useEffect(() => {
    if (!participantPickerOpen) return;
    const handleClickOutside = (e) => {
      if (leftRef.current && !leftRef.current.contains(e.target)) {
        setParticipantPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [participantPickerOpen]);

  const handlePickParticipant = async (p) => {
    await editFinances(item.id, { participant_id: p ? p.id : null });
    console.log('update lancamento participant', item.id, '->', p ? p.id : null, p?.name ?? null);
    setParticipantPickerOpen(false);
    updateFinanceInState(item.id, { participant_id: p ? p.id : null })
    // refreshfinances();
  };

  const handleToggleReview = async (e) => {
    stop(e);
    const next = !isReviewed;
    setIsReviewed(next);
    await editFinances(item.id, { is_reviewed: next });
    console.log('toggle reviewed', item.id, '->', next);
    updateFinanceInState(item.id, { is_reviewed: next });
  };

  const handleOpenEditDescription = (e) => {
    stop(e);
    setDescriptionDraft(item.description);
    setEditingDescription(true);
    setExpanded(true);
  };

  const handleCancelEditDescription = () => {
    setEditingDescription(false);
    setDescriptionDraft(item.description);
  };

  const handleSaveDescription = async () => {
    const trimmed = descriptionDraft.trim();
    if (!trimmed || trimmed === item.description) {
      setEditingDescription(false);
      return;
    }
    setSavingDescription(true);
    try {
      await editFinances(item.id, { description: trimmed });
      updateExtratoInState(item.id, { description: trimmed });
      setEditingDescription(false);
    } finally {
      setSavingDescription(false);
    }
  };

  const handleOpenEditFull = (e) => {
    stop(e);
    setFullDraft({
      description: item.description,
      amount: String(item.amount),
      transaction_date: item.transaction_date,
    });
    setEditingFull(true);
    setExpanded(true);
  };

  const handleCancelEditFull = () => {
    setEditingFull(false);
  };

  const handleSaveFull = async () => {
    const trimmedDesc = fullDraft.description.trim();
    const amountNumber = parseFloat(fullDraft.amount);
    if (!trimmedDesc || Number.isNaN(amountNumber) || !fullDraft.transaction_date) {
      return;
    }
    const payload = {};
    if (trimmedDesc !== item.description) payload.description = trimmedDesc;
    if (amountNumber !== Number(item.amount)) payload.amount = amountNumber;
    if (fullDraft.transaction_date !== item.transaction_date) {
      payload.transaction_date = fullDraft.transaction_date;
    }
    if (Object.keys(payload).length === 0) {
      setEditingFull(false);
      return;
    }
    setSavingFull(true);
    try {
      await editFinances(item.id, payload);
      updateFinanceInState(item.id, payload);
      setEditingFull(false);
    } finally {
      setSavingFull(false);
    }
  };

  const handleOpenConfirmDelete = (e) => {
    stop(e);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteFinance(item.id);
    } catch (error) {
      console.error(error);
      setConfirmDeleteOpen(false);
      return;
    }
    setConfirmDeleteOpen(false);
    setIsDeleting(true);
  };

  const handleAnimationEnd = (e) => {
    if (!isDeleting) return;
    if (e.animationName && e.animationName.includes('slideFadeDelete')) {
      removeFinanceInState(item.id);
      // refreshfinances?.();
    }
  };

  useEffect(() => {
    if (!confirmDeleteOpen) return;
    const handleClickOutside = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setConfirmDeleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [confirmDeleteOpen]);

  const participantColor = participant ? participantColors[participant.id] : null;

  const rowStyle = { '--i': index };
  if (participantColor) {
    rowStyle.backgroundColor = hexToRgba(participantColor, 0.45);
  }

  return (
    <li
      className={`${styles.row} ${(participantPickerOpen || confirmDeleteOpen) ? styles.rowActive : ''} ${isDeleting ? styles.deleting : ''}`}
      style={rowStyle}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        type="button"
        className={`${styles.summary} ${expanded ? styles.summaryOpen : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className={styles.left}>
          <div className={styles.badgeWrap} ref={leftRef} onClick={stop}>
            <button
              type="button"
              className={`${styles.badge} ${isOutflow ? styles.badgeOut : styles.badgeIn}`}
              aria-haspopup="listbox"
              aria-expanded={participantPickerOpen}
              onClick={(e) => {
                stop(e);
                setParticipantPickerOpen((v) => !v);
              }}
            >
              {participant ? participant.name : '—'}
            </button>

            {participantPickerOpen && (
              <div
                className={styles.participantPicker}
                role="listbox"
                aria-label="Selecionar participante"
              >
                {participants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.participantOption}
                    role="option"
                    aria-selected={participant?.id === p.id}
                    onClick={(e) => {
                      stop(e);
                      handlePickParticipant(p);
                    }}
                  >
                    <span
                      className={styles.participantSwatch}
                      style={{ background: participantColors[p.id] || 'var(--color-surface-alt)' }}
                    />
                    <span className={styles.participantName}>{p.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.participantOption} ${styles.participantClear}`}
                  role="option"
                  aria-selected={!participant}
                  onClick={(e) => {
                    stop(e);
                    handlePickParticipant(null);
                  }}
                >
                  <span className={styles.participantSwatch} />
                  <span className={styles.participantName}>Sem participante</span>
                </button>
              </div>
            )}
          </div>
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

          <div className={styles.actions} onClick={stop} ref={actionsRef}>
            <button
              type="button"
              className={`${styles.iconBtn} ${isReviewed ? styles.iconBtnActive : ''}`}
              aria-label={isReviewed ? 'Marcar como não revisado' : 'Marcar como revisado'}
              aria-pressed={isReviewed}
              title={isReviewed ? 'Revisado' : 'Não revisado'}
              onClick={handleToggleReview}
            >
              <CheckCircleIcon />
            </button>
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
              onClick={isExtrato ? handleOpenEditDescription : handleOpenEditFull}
            >
              <EditIcon />
            </button>
            {!isExtrato && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.danger}`}
                aria-label="Excluir"
                onClick={handleOpenConfirmDelete}
              >
                <TrashIcon />
              </button>
            )}

            {confirmDeleteOpen && (
              <div className={styles.confirmPop} role="dialog" aria-label="Confirmar exclusão">
                <span className={styles.confirmText}>Excluir?</span>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={`${styles.confirmBtn} ${styles.confirm}`}
                    onClick={handleConfirmDelete}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    className={`${styles.confirmBtn} ${styles.danger}`}
                    onClick={() => setConfirmDeleteOpen(false)}
                  >
                    Não
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        id={panelId}
        className={`${styles.panel} ${expanded ? styles.panelOpen : ''}`}
        role="region"
      >
        <div className={styles.panelInner}>
          {!isExtrato && editingFull && (
            <div className={styles.editForm} onClick={stop}>
              <div className={styles.editGrid}>
                <label className={styles.editLabel}>
                  Descrição
                  <input
                    type="text"
                    className={styles.editInput}
                    value={fullDraft.description}
                    onChange={(e) => setFullDraft((d) => ({ ...d, description: e.target.value }))}
                    disabled={savingFull}
                    autoFocus
                  />
                </label>
                <label className={styles.editLabel}>
                  Valor
                  <input
                    type="number"
                    // step="0.01"
                    min="0"
                    className={styles.editInput}
                    value={fullDraft.amount}
                    onChange={(e) => setFullDraft((d) => ({ ...d, amount: e.target.value }))}
                    disabled={savingFull}
                  />
                </label>
                <label className={styles.editLabel}>
                  Data
                  <input
                    type="date"
                    className={styles.editInput}
                    value={fullDraft.transaction_date}
                    onChange={(e) => setFullDraft((d) => ({ ...d, transaction_date: e.target.value }))}
                    disabled={savingFull}
                  />
                </label>
              </div>
              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.editCancel}
                  onClick={handleCancelEditFull}
                  disabled={savingFull}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.editSave}
                  onClick={handleSaveFull}
                  disabled={savingFull}
                >
                  {savingFull ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
          {isExtrato && editingDescription && (
            <div className={styles.editForm} onClick={stop}>
              <label className={styles.editLabel}>
                Descrição
                <input
                  type="text"
                  className={styles.editInput}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  disabled={savingDescription}
                  autoFocus
                />
              </label>
              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.editCancel}
                  onClick={handleCancelEditDescription}
                  disabled={savingDescription}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.editSave}
                  onClick={handleSaveDescription}
                  disabled={savingDescription}
                >
                  {savingDescription ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
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
              <dd>{isReviewed ? 'Sim' : 'Não'}</dd>
            </div>
            <div className={styles.detail}>
              <dt>Data Transação</dt>
              <dd>{formatDate(item.transaction_date)}</dd>
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
