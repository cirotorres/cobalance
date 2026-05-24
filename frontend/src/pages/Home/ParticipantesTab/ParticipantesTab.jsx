import { useEffect, useState } from 'react';
import ParticipanteRow from './ParticipanteRow';
import styles from './ParticipantesTab.module.css';
import stylesrow from './ParticipanteRow.module.css';
import { listParticipants, updateParticipantColor, adicionarParticipante } from '../../../services/participantService';
import TabLoading from "../../../components/TabLoading/TabLoading"

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


function ParticipantesTab({ participantColors = {}, setParticipantColors }) {
  const [participants, setParticipants] = useState([]);
  const [createNewRow, setCreateNewRow] = useState(false);
  const [newParticipant, setNewParticipant] = useState(null);
  const [loading, setLoading] = useState(false);


const fetchParticipants = async () => {
  try {
    setLoading(true)
    const data = await listParticipants();
    setParticipants(data);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false)
  }
};

useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  fetchParticipants();

}, []);


  const clickCreate = () => {
    setCreateNewRow(true)
  }

  const cancelCreate = () =>{
    setCreateNewRow(false);
    setNewParticipant('');
  }

  const handleChangeColor = async (id, hex) => {

    await updateParticipantColor(id, hex);

    setParticipantColors((prev) => {
      const next = { ...prev };
      if (hex === null) {
        delete next[id];
      } else {
        next[id] = hex;
      }
      return next;
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    try{
      await adicionarParticipante(newParticipant)
      await fetchParticipants();
      setNewParticipant(null);
      setCreateNewRow(false);
      console.log('Participante adicionado.')

    } catch (error) {
      console.error(error);
    }
  }

  const handleDeleteParticipant = async (id) => {
  setParticipants((prev) =>
    prev.filter((p) => p.id !== id)
  );
};

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Participantes</h2>
        <button
          type="button"
          className={styles.addBtn}
          onClick={clickCreate}
          aria-label="Adicionar participante"
        >
          <PlusIcon />
        </button>
      </div>

{
  participants.length === 0 ? (
    <div className={styles.emptyParticipant}>
      Sem participantes. Clique no ícone " + " e adicione seus participantes.
    </div>
  ) : loading ? (
    <TabLoading />
  ) : (
    <ul className={styles.list}>
      {participants.map((p, index) => (
        <ParticipanteRow
          key={p.id}
          participant={p}
          index={index}
          color={participantColors[p.id]}
          onChangeColor={handleChangeColor}
          onDelete={handleDeleteParticipant}
          refreshParticipants={fetchParticipants}
        />
      ))}
    </ul>
  )
}

      {createNewRow && (
        <form onSubmit={handleAdd}>
          <div className={stylesrow.row}>
              <div className={stylesrow.summary}>
                  <div className={stylesrow.left}>
                    <span className={stylesrow.badge}></span>
                    <div className={stylesrow.meta}>
                      <input 
                        className={stylesrow.inputRow} 
                        placeholder='Nome' 
                        value={newParticipant}
                        onChange={(e) => setNewParticipant(e.target.value)}
                        required
                        />
                    </div>
                    <button
                      type="submit"
                      className={`${stylesrow.iconBtn} ${stylesrow.confirm}`}
                      aria-label="Confirmar"
                    >
                      <CheckIcon />
                    </button>

                    <button
                      type="button"
                      className={`${stylesrow.iconBtn} ${stylesrow.danger}`}
                      aria-label="Excluir"
                      onClick={() => cancelCreate(false)}
                    >
                      <XIcon />
                    </button>
                  </div>
              </div>
          </div> 
        </form>
        )}
    </section>
  );
}

export default ParticipantesTab;
