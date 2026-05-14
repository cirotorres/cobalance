import { useEffect, useState } from 'react';
import ParticipanteRow from './ParticipanteRow';
import styles from './ParticipantesTab.module.css';
import { listParticipants } from '../../../services/authService';

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

function ParticipantesTab({ participantColors = {}, setParticipantColors }) {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const data = await listParticipants();
        setParticipants(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchParticipants();
  }, []);

  const handleAdd = () => {
    console.log('add participante');
  };

  const handleChangeColor = (id, hex) => {
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

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Participantes</h2>
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAdd}
          aria-label="Adicionar participante"
        >
          <PlusIcon />
        </button>
      </div>

      <ul className={styles.list}>
        {participants.map((p, index) => (
          <ParticipanteRow
            key={p.id}
            participant={p}
            index={index}
            color={participantColors[p.id]}
            onChangeColor={handleChangeColor}
          />
        ))}
      </ul>
    </section>
  );
}

export default ParticipantesTab;
