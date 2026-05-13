import { useState, useEffect } from 'react';
// import finances from '../../../mocks/finances';
import LancamentoRow from './LancamentoRow';
import styles from './LancamentosTab.module.css';
import { listFinances } from '../../../services/authService'

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

function LancamentosTab() {

  const [finances, setFinances] = useState([]);

  useEffect( () => {
      const fetchFinances = async () =>{
          try{
              const data = await listFinances();
              setFinances(data);
          } catch (error) {
              console.error(error)
          };
      }
      fetchFinances();
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

      <ul className={styles.list}>
        {finances.map((item, index) => (
          <LancamentoRow key={item.id} item={item} index={index} />
        ))}
      </ul>
    </section>
  );
}

export default LancamentosTab;
