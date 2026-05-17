import { useState, useEffect } from 'react';
import LancamentoRow from './LancamentoRow';
import styles from './LancamentosTab.module.css';
import { listFinances } from '../../../services/financialService'
import { listParticipants } from '../../../services/participantService'
import FinancesFilters from '../FinancesFilters/FinancesFilters';
import { filterFinances, EMPTY_FILTERS } from '../FinancesFilters/filterFinances';

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

function LancamentosTab({ participantColors = {} }) {

  const [participants, setParticipants] = useState([])

  const [finances, setFinances] = useState([]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);



  const fetchFinances = async () =>{
    try{
        const data = await listFinances();

        const data_filt = data.filter(
          (finance) => finance.source === "credito"
        );

        setFinances(data_filt);
    } catch (error) {
        console.error(error)
    };
}
  useEffect( () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFinances();
      }, [])

  useEffect( () => {
      const fetchParticipants = async () =>{
          try{
              const data = await listParticipants();
              setParticipants(data);
              console.log(data)
          } catch (error) {
              console.error(error)
          };
      }
      fetchParticipants();
      }, [])


  const handleAdd = () => {
    console.log('add lancamento');
  };

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Lançamentos</h2>
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAdd}
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
                />
              ))}
          </ul>
        );
      })()}
    </section>
  );
}

export default LancamentosTab;
