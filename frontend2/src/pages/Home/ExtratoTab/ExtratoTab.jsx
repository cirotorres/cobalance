import { useRef, useState } from 'react';
import styles from './ExtratoTab.module.css';
import LancamentoRow from '../LancamentosTab/LancamentoRow';
import FinancesFilters from '../FinancesFilters/FinancesFilters';
import { filterFinances, EMPTY_FILTERS } from '../FinancesFilters/filterFinances';

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

function ExtratoTab({lancamentos, participants, participantColors, refreshfinances}) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('upload extrato:', file.name);
      setFileName(file.name);
    }
    e.target.value = '';
  };

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Extrato bancário</h2>
        <button
          type="button"
          className={styles.uploadBtn}
          onClick={handleClick}
          aria-label="Enviar extrato"
        >
          <UploadIcon />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.ofx,.pdf,.xlsx,.xls"
          className={styles.hiddenInput}
          onChange={handleChange}
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
        if (lancamentos.length > 0 && filtered.length === 0) {
          return (
            <div className={styles.empty}>
              Nenhum lançamento corresponde aos filtros aplicados.
            </div>
          );
        }
        return (
          <ul className={styles.list}>
            {[...filtered]
              .sort((a, b) => {
                if (!!a.is_reviewed !== !!b.is_reviewed) {
                  return a.is_reviewed ? 1 : -1;
                }
                if (a.transaction_date !== b.transaction_date) {
                  return a.transaction_date < b.transaction_date ? -1 : 1;
                }
                return a.id - b.id;
              })
              .map((item, index) => (
                <LancamentoRow
                  key={item.id}
                  item={item}
                  index={index}
                  participants={participants}
                  participantColors={participantColors}
                  refreshfinances={refreshfinances}
                />
              ))}
          </ul>
        );
      })()}
    </section>
  );
}

export default ExtratoTab;
