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

function formatMonthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function MonthPicker({ months, value, onChange }) {
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

  const isActive = !!value;
  const label = isActive ? formatMonthLabel(value) : 'Todos';

  return (
    <div className={styles.pickerWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isActive ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerLabel}>Mês:</span>
        <span className={styles.triggerValue}>{label}</span>
        <span className={styles.caret}>
          <CaretIcon />
        </span>
      </button>

      {open && (
        <div className={styles.popover} role="listbox">
          <button
            type="button"
            className={`${styles.option} ${!value ? styles.optionSelected : ''}`}
            onClick={() => handlePick('')}
          >
            Todos
          </button>
          {months.length > 0 && <div className={styles.optionDivider} />}
          {months.map((ym) => (
            <button
              key={ym}
              type="button"
              className={`${styles.option} ${value === ym ? styles.optionSelected : ''}`}
              onClick={() => handlePick(ym)}
            >
              {formatMonthLabel(ym)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MonthPicker;
