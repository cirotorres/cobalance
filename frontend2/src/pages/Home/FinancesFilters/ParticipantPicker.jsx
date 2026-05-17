import { useEffect, useRef, useState } from 'react';
import styles from './Pickers.module.css';

function CaretIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ParticipantPicker({
  participants,
  participantColors = {},
  hasNullParticipant,
  value,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handlePick = (val) => {
    onChange(val);
    setOpen(false);
  };

  const isActive = value !== 'all';

  let label = 'Todos';
  if (value === 'none') {
    label = 'Sem participante';
  } else if (value !== 'all') {
    const p = participants.find((x) => x.id === value);
    if (p) label = p.name;
  }

  return (
    <div className={styles.pickerWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isActive ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerLabel}>Participante:</span>
        <span className={styles.triggerValue}>{label}</span>
        <span className={styles.caret}>
          <CaretIcon />
        </span>
      </button>

      {open && (
        <div className={styles.popover} role="listbox">
          <button
            type="button"
            className={`${styles.option} ${value === 'all' ? styles.optionSelected : ''}`}
            onClick={() => handlePick('all')}
          >
            Todos
          </button>
          {(participants.length > 0 || hasNullParticipant) && (
            <div className={styles.optionDivider} />
          )}
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.option} ${value === p.id ? styles.optionSelected : ''}`}
              onClick={() => handlePick(p.id)}
            >
              <span
                className={styles.swatch}
                style={{ background: participantColors[p.id] || 'var(--color-surface-alt)' }}
              />
              {p.name}
            </button>
          ))}
          {hasNullParticipant && (
            <button
              type="button"
              className={`${styles.option} ${value === 'none' ? styles.optionSelected : ''}`}
              onClick={() => handlePick('none')}
            >
              <span className={styles.swatch} />
              Sem participante
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ParticipantPicker;
