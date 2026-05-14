import { useEffect, useRef, useState } from 'react';
import styles from './ParticipanteRow.module.css';

const PALETTE = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#64748B',
];

function EditIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function ParticipanteRow({ participant, index, color, onChangeColor }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const rightRef = useRef(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const handleClickOutside = (e) => {
      if (rightRef.current && !rightRef.current.contains(e.target)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [paletteOpen]);

  const initial = (participant.name || '?').charAt(0).toUpperCase();

  const handlePick = (hex) => {
    onChangeColor(participant.id, hex);
    setPaletteOpen(false);
  };

  return (
    <li
      className={`${styles.row} ${paletteOpen ? styles.rowActive : ''}`}
      style={{ '--i': index }}
    >
      <div className={styles.summary}>
        <div className={styles.left}>
          <span className={styles.badge}>{initial}</span>
          <div className={styles.meta}>
            <span className={styles.name}>{participant.name}</span>
          </div>
        </div>

        <div className={styles.right} ref={rightRef}>
          <button
            type="button"
            className={styles.colorBtn}
            style={{ background: color || 'var(--color-surface-alt)' }}
            aria-label="Escolher cor"
            onClick={() => setPaletteOpen((v) => !v)}
          />

          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Editar"
            onClick={() => console.log('edit participant', participant.id)}
          >
            <EditIcon />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.danger}`}
            aria-label="Excluir"
            onClick={() => console.log('delete participant', participant.id)}
          >
            <TrashIcon />
          </button>

          {paletteOpen && (
            <div className={styles.palette} role="dialog" aria-label="Paleta de cores">
              {PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={styles.swatch}
                  style={{ background: hex }}
                  aria-label={`Cor ${hex}`}
                  onClick={() => handlePick(hex)}
                />
              ))}
              <button
                type="button"
                className={`${styles.swatch} ${styles.swatchClear}`}
                aria-label="Remover cor"
                onClick={() => handlePick(null)}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default ParticipanteRow;
