import { useRef, useState } from 'react';
import styles from './ExtratoTab.module.css';

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

function ExtratoTab() {
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

      <div className={styles.empty}>
        {fileName ? (
          <>
            <p className={styles.emptyTitle}>Arquivo recebido</p>
            <p className={styles.emptyText}>{fileName}</p>
            <p className={styles.emptyHint}>
              (simulação — nenhum dado foi processado ainda)
            </p>
          </>
        ) : (
          <>
            <p className={styles.emptyTitle}>Nenhum extrato carregado</p>
            <p className={styles.emptyText}>
              Faça upload do extrato do seu cartão para visualizar os lançamentos.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default ExtratoTab;
