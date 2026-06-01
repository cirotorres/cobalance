import { useState, useEffect } from 'react';
import LancamentoRow from './LancamentoRow';
import styles from './LancamentosTab.module.css';
import { listFinances, addFinance } from '../../../services/financialService'
import { listParticipants } from '../../../services/participantService'
import FinancesFilters from '../FinancesFilters/FinancesFilters';
import { filterFinances } from '../FinancesFilters/filterFinances';
import TabLoadingLanc from '../../../components/TabLoading/TabLoadingLanc';

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const SOURCE_OPTIONS = [
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
  { value: 'pix', label: 'Pix' },
];

const MANUAL_SOURCES = SOURCE_OPTIONS.map((s) => s.value);

const todayIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const addMonthsIso = (iso, monthsToAdd) => {
  const [y, m, d] = iso.split('-').map(Number);
  const targetMonthZero = (m - 1) + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthZero / 12);
  const targetMonth = ((targetMonthZero % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const emptyDraft = () => ({
  description: '',
  amount: '',
  transaction_date: todayIso(),
  participant_id: '',
  source: 'credito',
  installments: '1',
});

function LancamentosTab({ participantColors = {}, filters, setFilters }) {

  const [participants, setParticipants] = useState([])
  const [finances, setFinances] = useState([]);
  // const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);


const fetchFinances = async () => {
  try {
    setLoading(true);
    const data = await listFinances();
    const data_filt = data.filter(
      (finance) => MANUAL_SOURCES.includes(finance.source)
    );
    setFinances(data_filt);

  } catch (error) {
    console.error(error);

  } finally {
    setLoading(false);
  }
};

const addManyFinancesInState = (newFinances) => {
  setFinances(prev => [...prev, ...newFinances]);
};

  useEffect( () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFinances();
      }, [])

  useEffect( () => {
      const fetchParticipants = async () =>{
          try{
              const data = await listParticipants();
              setParticipants(data);
          } catch (error) {
              console.error(error)
          }
      }
      fetchParticipants();
      }, [])


  const handleOpenCreate = () => {
    setDraft(emptyDraft());
    setCreateOpen(true);
  };

  const handleCancelCreate = () => {
    setCreateOpen(false);
    setDraft(emptyDraft());
  };

  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    const createdFinances = []; 
    const amountNumber = parseFloat(draft.amount);
    const installmentsTotal = Math.max(1, parseInt(draft.installments, 10) || 1);
    if (!draft.description.trim() || Number.isNaN(amountNumber) || !draft.transaction_date) {
      return;
    }
    setSaving(true);
    try {
      const basePayload = {
        participant_id: draft.participant_id === '' ? null : Number(draft.participant_id),
        amount: amountNumber,
        description: draft.description.trim(),
        source: draft.source,
        is_reviewed: false,
        installment_total: installmentsTotal,
      };
      for (let i = 0; i < installmentsTotal; i++) {
        const financeCreated = await addFinance({
          ...basePayload,
          transaction_date: addMonthsIso(draft.transaction_date, i),
          installment_number: i + 1,
        });
        createdFinances.push(financeCreated);
      }
      addManyFinancesInState(createdFinances);
      setCreateOpen(false);
      setDraft(emptyDraft());
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateFinanceInState = (id, updates) => {
  setFinances(prev => prev.map(finance => finance.id === id
        ? { ...finance, ...updates}
        : finance
      )
    );
  };

  const removeFinanceInState = (id) => {
  setFinances(prev =>
    prev.filter(
      finance => finance.id !== id
    )
  );
};

const createLancamentosInState = (novoLancamento) => {
  setParticipants( prev => [...prev,novoLancamento] )
}

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Lançamentos</h2>
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleOpenCreate}
          aria-label="Adicionar lançamento"
        >
          <PlusIcon />
        </button>
      </div>

      <FinancesFilters
        finances={finances}
        participants={participants}
        participantColors={participantColors}
        value={filters}
        onChange={setFilters}
      />

      {(() => {
        const filtered = filterFinances(finances, filters);
        if (finances.length > 0 && filtered.length === 0) {
          return (
            <div className={styles.empty}>
              Nenhum lançamento corresponde aos filtros aplicados.
            </div>
          );
        }
        return (
          loading ? (
            <TabLoadingLanc />
          ) : filtered.length === 0 ? (
            <div className={styles.emptyLanca}>
              Nenhum lançamento. Clique no ícone acima e adicione um lançamento.
            </div>
          ) : (
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
                    refreshfinances={fetchFinances}
                    updateFinanceInState={updateFinanceInState}
                    removeFinanceInState={removeFinanceInState}
                  />
                ))}
            </ul>
          )
        );
      })()}

      {createOpen && (
        <form className={styles.createForm} onSubmit={handleSubmitCreate}>
          <div className={styles.createGrid}>
            <label className={styles.createField}>
              <span className={styles.createLabel}>Descrição</span>
              <input
                type="text"
                className={styles.createInput}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                required
                autoFocus
                disabled={saving}
              />
            </label>
            <label className={styles.createField}>
              <span className={styles.createLabel}>Valor</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={styles.createInput}
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                required
                disabled={saving}
              />
            </label>
            <label className={styles.createField}>
              <span className={styles.createLabel}>Data</span>
              <input
                type="date"
                className={styles.createInput}
                value={draft.transaction_date}
                onChange={(e) => setDraft((d) => ({ ...d, transaction_date: e.target.value }))}
                required
                disabled={saving}
              />
            </label>
            <label className={styles.createField}>
              <span className={styles.createLabel}>Parcelas</span>
              <input
                type="number"
                min="1"
                step="1"
                className={styles.createInput}
                value={draft.installments}
                onChange={(e) => setDraft((d) => ({ ...d, installments: e.target.value }))}
                disabled={saving}
              />
            </label>
            <label className={styles.createField}>
              <span className={styles.createLabel}>Participante</span>
              <select
                className={styles.createInput}
                value={draft.participant_id}
                onChange={(e) => setDraft((d) => ({ ...d, participant_id: e.target.value }))}
                disabled={saving}
              >
                <option value="">Sem participante</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.createSourceRow}>
            <span className={styles.createLabel}>Tipo</span>
            <div className={styles.sourceOptions} role="radiogroup" aria-label="Tipo">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.source === opt.value}
                  className={`${styles.sourceChip} ${draft.source === opt.value ? styles.sourceChipActive : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, source: opt.value }))}
                  disabled={saving}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.createActions}>
            <button
              type="button"
              className={`${styles.createBtn} ${styles.createCancel}`}
              onClick={handleCancelCreate}
              disabled={saving}
              aria-label="Cancelar"
            >
              <XIcon />
            </button>
            <button
              type="submit"
              className={`${styles.createBtn} ${styles.createConfirm}`}
              disabled={saving}
              aria-label="Confirmar"
            >
              <CheckIcon />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default LancamentosTab;

