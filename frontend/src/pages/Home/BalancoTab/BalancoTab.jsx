import { useEffect, useMemo, useState } from 'react';
import BalancoParticipanteCard from './BalancoParticipanteCard';
import styles from './BalancoTab.module.css';
import { listFinances, editFinancesReviewStatus } from '../../../services/financialService';
import  PizzaGraph  from './PizzaGraph';

function BalancoTab({ participants = [], participantColors = {} }) {
  const [finances, setFinances] = useState([]);
  const [bulkScope, setBulkScope] = useState(null);
  const [bulkError, setBulkError] = useState('');

  useEffect(() => {
    const fetchFinances = async () => {
      try {
        const data = await listFinances();
        setFinances(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchFinances();
  }, []);

  const handleToggleReview = (id, next) => {
    setFinances((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_reviewed: next } : f))
    );
  };

  const handleClear = async (items, scope) => {
    const ids = items.map((item) => item.id);
    if (ids.length === 0 || bulkScope) return;

    setBulkScope(scope);
    setBulkError('');
    try {
      const result = await editFinancesReviewStatus(ids, false);
      const updatedIds = new Set(result.updated_ids);
      setFinances((prev) => prev.map((finance) =>
        updatedIds.has(finance.id)
          ? { ...finance, is_reviewed: false }
          : finance
      ));
    } catch (error) {
      console.error(error);
      setBulkError('Não foi possível limpar o balanço. Tente novamente.');
    } finally {
      setBulkScope(null);
    }
  };

  const groups = useMemo(() => {
    const reviewed = finances.filter(
      (f) => f.is_reviewed && 
            f.participant_id !== null && 
            f.participant_id !== undefined
    );
    return participants
      .map((p) => ({
        participant: p,
        items: reviewed.filter((f) => f.participant_id === p.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [finances, participants]);

  return (
    
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Balanço</h2>
        {groups.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => handleClear(groups.flatMap((group) => group.items), 'all')}
            disabled={bulkScope !== null}
            title="Desmarcar todos os itens sem excluí-los"
          >
            {bulkScope === 'all' ? 'Limpando...' : 'Limpar balanço'}
          </button>
        )}
      </div>

      {bulkError && <p className={styles.error} role="alert">{bulkError}</p>}

      {groups.length === 0 ? (
        <div className={styles.empty}>
          Nenhum lançamento revisado ainda. Marque o ícone ✓ em Lançamentos ou Extrato bancário para popular esta aba.
        </div>
      ) : (
        <div className={styles.balancoLayout}>
          <ul className={styles.list}>
            {groups.map((g, i) => (
              <BalancoParticipanteCard
                key={g.participant.id}
                index={i}
                participant={g.participant}
                color={participantColors[g.participant.id]}
                items={g.items}
                onToggleReview={handleToggleReview}
                onClear={() => handleClear(g.items, `participant-${g.participant.id}`)}
                clearing={bulkScope === 'all' || bulkScope === `participant-${g.participant.id}`}
                bulkDisabled={bulkScope !== null}
              />
            ))}
          </ul>
          <div className={styles.pizzaWrap}>
            <PizzaGraph financas={groups} />
          </div>
         </div>
      )}
    </section>
  );
}

export default BalancoTab;
