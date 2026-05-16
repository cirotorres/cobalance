import { useRef, useState } from 'react';
import styles from './ExtratoTab.module.css';
import LancamentoRow from '../LancamentosTab/LancamentoRow';

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

function ExtratoTab({lancamentos, participants, participantColors}) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState(null);

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
      <ul className={styles.list}>
        {lancamentos.map((item, index) => (
          <LancamentoRow
            key={item.id}
            item={item}
            index={index}
            participants={participants}
            participantColors={participantColors}
          />
        ))}
      </ul>
    </section>
  );
}

export default ExtratoTab;
