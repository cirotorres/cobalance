import { useEffect, useState } from 'react';
import { loansApi, apiError } from '../../services/loansService';
import BorrowerStatement from './BorrowerStatement';
import styles from './Loans.module.css';

function BorrowersTab({ focusId = null }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [current, setCurrent] = useState(focusId);
  const [error, setError] = useState('');

  const load = () => loansApi.listBorrowers().then(setList).catch((e) => setError(apiError(e)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = { name };
      if (contact) body.contact = contact;
      const b = await loansApi.createBorrower(body);
      setName(''); setContact('');
      await load();
      setCurrent(b.id);
    } catch (err) { setError(apiError(err)); }
  };

  return (
    <div className={styles.split}>
      <aside className={styles.card}>
        <h3>Tomadores</h3>
        <p className={styles.muted}>Cadastro próprio do módulo Empréstimos (independente das pessoas de Cartões).</p>
        <ul className={`${styles.list} ${styles.borrowerChips}`} aria-label="Tomadores">
          {list.map((b) => (
            <li key={b.id}>
              <button type="button" aria-pressed={b.id === current}
                className={`${styles.borrowerPill} ${b.id === current ? styles.borrowerPillSelected : ''}`}
                onClick={() => setCurrent(b.id)}>{b.id === current && <span aria-hidden="true">✓ </span>}{b.name}</button>
            </li>
          ))}
        </ul>
        <form onSubmit={create} className={styles.formGrid} aria-label="Novo tomador">
          <label className={styles.field}>Nome do tomador<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
          <label className={styles.field}>Contato (opcional)<input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} /></label>
          <button type="submit" className={styles.primary}>Cadastrar tomador</button>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
      </aside>
      <div>{current ? <BorrowerStatement key={current} borrowerId={current} /> : <p className={styles.muted}>Selecione um tomador.</p>}</div>
    </div>
  );
}

export default BorrowersTab;
