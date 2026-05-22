import { useEffect, useMemo, useState } from 'react';
import BalancoParticipanteCard from './BalancoParticipanteCard';
import styles from './BalancoTab.module.css';
import { listFinances } from '../../../services/financialService';
import  PizzaGraph  from './PizzaGraph';

function BalancoTab({ participants = [], participantColors = {} }) {
  const [finances, setFinances] = useState([]);

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
    // atualização local — back-end ainda não conectado para este flow
    setFinances((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_reviewed: next } : f))
    );
    console.log('toggle reviewed', id, '->', next);
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
      </div>

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
