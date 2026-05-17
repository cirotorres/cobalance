import { useEffect, useRef, useState } from 'react';
import styles from './ExtratoTab.module.css';
import LancamentoRow from '../LancamentosTab/LancamentoRow';
import FinancesFilters from '../FinancesFilters/FinancesFilters';
import { filterFinances, EMPTY_FILTERS } from '../FinancesFilters/filterFinances';
import { uploadDocument, deleteExtratoByMonth } from '../../../services/financialService'

function UploadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]}/${year}`;
}

function formatAmount(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function groupByMonth(items) {
  const groups = new Map();
  for (const item of items) {
    const monthKey = item.transaction_date.slice(0, 7);
    if (!groups.has(monthKey)) {
      groups.set(monthKey, []);
    }
    groups.get(monthKey).push(item);
  }
  for (const [, rows] of groups) {
    rows.sort((a, b) => {
      if (!!a.is_reviewed !== !!b.is_reviewed) {
        return a.is_reviewed ? 1 : -1;
      }
      if (a.transaction_date !== b.transaction_date) {
        return a.transaction_date < b.transaction_date ? -1 : 1;
      }
      return a.id - b.id;
    });
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function ExtratoTab({lancamentos, participants, participantColors, refreshfinances}) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [deletingMonth, setDeletingMonth] = useState(null);
  const [confirmMonth, setConfirmMonth] = useState(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!confirmMonth) return;
    const handleClickOutside = (e) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target)) {
        setConfirmMonth(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [confirmMonth]);


const handleFile = async (e) => {
  const file = e.target.files[0];

  if (!file) return;
  try {
    setFileName(file.name);

    await uploadDocument(file);
    await refreshfinances();

    console.log("Upload concluído");

  } catch (error) {
    console.error(error);
  }
};

  const toggleMonth = (monthKey) => {
    setCollapsedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const handleConfirmDeleteMonth = async (monthKey) => {
    setDeletingMonth(monthKey);
    try {
      await deleteExtratoByMonth(monthKey);
      await refreshfinances();
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingMonth(null);
      setConfirmMonth(null);
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Extrato bancário</h2>
        <button
          className={styles.uploadBtn}
          onClick={() => inputRef.current.click()}
          aria-label="Enviar extrato"
        >
          <UploadIcon />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className={styles.hiddenInput}
          onChange={handleFile}
        />
      </div>
      <FinancesFilters
        finances={lancamentos}
        participants={participants}
        participantColors={participantColors}
        value={filters}
        onChange={setFilters}
      />

      {(() => {
        const filtered = filterFinances(lancamentos, filters);

        if (lancamentos.length === 0) {
          return (
            <div className={styles.emptyExtrato}>
              Nenhum Extrato bancário. Clique no ícone acima e carregue seu extrato.
            </div>
          );
        }

        if (filtered.length === 0) {
          return (
            <div className={styles.empty}>
              Nenhum lançamento corresponde aos filtros aplicados.
            </div>
          );
        }

        const groups = groupByMonth(filtered);
        let rowIndex = 0;

        return (
          <div className={styles.monthGroups}>
            {groups.map(([monthKey, rows]) => {
              const isCollapsed = !!collapsedMonths[monthKey];
              const totalAmount = rows.reduce((acc, r) => acc + Number(r.amount), 0);
              return (
                <div key={monthKey} className={styles.monthGroup}>
                  <div className={styles.monthHeader}>
                    <button
                      type="button"
                      className={styles.monthToggle}
                      onClick={() => toggleMonth(monthKey)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className={`${styles.monthChevron} ${isCollapsed ? '' : styles.monthChevronOpen}`}>▸</span>
                      <span className={styles.monthLabel}>{formatMonthLabel(monthKey)}</span>
                      <span className={styles.monthMeta}>
                        {rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'} · {formatAmount(totalAmount)}
                      </span>
                    </button>
                    <div
                      className={styles.monthDeleteWrap}
                      ref={confirmMonth === monthKey ? confirmRef : null}
                    >
                      <button
                        type="button"
                        className={styles.monthDelete}
                        onClick={() => setConfirmMonth(monthKey)}
                        disabled={deletingMonth === monthKey}
                        aria-label={`Excluir extrato de ${formatMonthLabel(monthKey)}`}
                        title={`Excluir extrato de ${formatMonthLabel(monthKey)}`}
                      >
                        <TrashIcon />
                      </button>
                      {confirmMonth === monthKey && (
                        <div className={styles.confirmPop} role="dialog" aria-label="Confirmar exclusão">
                          <span className={styles.confirmText}>Excluir?</span>
                          <div className={styles.confirmActions}>
                            <button
                              type="button"
                              className={`${styles.confirmBtn} ${styles.confirm}`}
                              onClick={() => handleConfirmDeleteMonth(monthKey)}
                              disabled={deletingMonth === monthKey}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              className={`${styles.confirmBtn} ${styles.danger}`}
                              onClick={() => setConfirmMonth(null)}
                              disabled={deletingMonth === monthKey}
                            >
                              Não
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isCollapsed && (
                    <ul className={styles.list}>
                      {rows.map((item) => {
                        const i = rowIndex++;
                        return (
                          <LancamentoRow
                            key={item.id}
                            item={item}
                            index={i}
                            participants={participants}
                            participantColors={participantColors}
                            refreshfinances={refreshfinances}
                            variant="extrato"
                          />
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </section>
  );
}

export default ExtratoTab;
