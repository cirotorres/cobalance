import { useEffect, useRef, useState } from 'react';
import styles from './ParticipanteRow.module.css';
import { deleteParticipante, updateParticipant } from '../../../services/participantService'

const PALETTE = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#699df0',
  '#9368f8',
  '#EC4899',
  '#14B8A6',
  '#8b6464',
  '#FFFF00'
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

function ParticipanteRow({ participant, index, color, onChangeColor, onDelete, refreshParticipants, updateParticipantInState }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rightRef = useRef(null);
  const [isDeleting, setItsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(participant.name || '');


  useEffect(() => {
    if (!paletteOpen && !confirmOpen) return;
    const handleClickOutside = (e) => {
      if (rightRef.current && !rightRef.current.contains(e.target)) {
        setPaletteOpen(false);
        setConfirmOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [paletteOpen, confirmOpen]);

  const initial = (participant.name || '?').charAt(0).toUpperCase();

  const handlePick = (hex) => {
    onChangeColor(participant.id, hex);
    setPaletteOpen(false);
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    try {
      await deleteParticipante(participant.id);
    } catch (error) {
      console.log(error);
      return;
    }
    setConfirmOpen(false);
    setItsDeleting(true);
  };

  const handleAnimationEnd = (e) => {
    if (!isDeleting) return;
    if (e.animationName && e.animationName.includes('slideFadeDelete')) {
      onDelete(participant.id);
      console.log("Participante deletado.");
    }
  };

  const openConfirm = () => {
    setPaletteOpen(false);
    setConfirmOpen(true);
  };

  const cancelConfirm = () => {
    setConfirmOpen(false);
  };

  const openEdit = () => {
    setEditName(participant.name || '');
    setPaletteOpen(false);
    setConfirmOpen(false);
    setEditOpen(true);
  };

  const cancelEdit = () => {
    setEditOpen(false);
    setEditName(participant.name || '');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    await updateParticipant(participant.id, {name: editName})
    console.log('edit participant', participant.id, '->', editName);
    
    updateParticipantInState(participant.id, { name: editName })

    setEditOpen(false);
  };

  return (
    <li
      className={`${styles.row} ${paletteOpen || confirmOpen ? styles.rowActive : ''} ${isDeleting ? styles.deleting : ''}`}
      style={{ '--i': index }}
      onAnimationEnd={handleAnimationEnd}
    >
      {editOpen ? (
        <form onSubmit={handleEditSubmit}>
          <div className={styles.summary}>
            <div className={styles.left}>
              <span className={styles.badge}></span>
              <div className={styles.meta}>
                <input
                  className={styles.inputRow}
                  placeholder="Nome"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className={`${styles.iconBtn} ${styles.confirm}`}
                aria-label="Confirmar"
              >
                <CheckIcon />
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.danger}`}
                aria-label="Cancelar"
                onClick={cancelEdit}
              >
                <XIcon />
              </button>
            </div>
          </div>
        </form>
      ) : (
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
            onClick={openEdit}
          >
            <EditIcon />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.danger}`}
            aria-label="Excluir"
            onClick={openConfirm}
          >
            <TrashIcon />
          </button>

          {confirmOpen && (
            <div className={styles.confirmPop} role="dialog" aria-label="Confirmar exclusão">
              <span className={styles.confirmText}>Excluir?</span>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.confirm}`}
                  aria-label="Sim"
                  onClick={handleDelete}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.danger}`}
                  aria-label="Não"
                  onClick={cancelConfirm}
                >
                  Não
                </button>
              </div>
            </div>
          )}

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
      )}
    </li>
  );
}

export default ParticipanteRow;
