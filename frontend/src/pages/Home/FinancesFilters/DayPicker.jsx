import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Pickers.module.css';
import dayStyles from './DayPicker.module.css';

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

function ArrowIcon({ dir }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

const DOW_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDayLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function DayPicker({ days, months, value, onChange, monthFilter }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const fallbackMonth =
    monthFilter ||
    (value ? value.slice(0, 7) : '') ||
    (months.length > 0 ? months[months.length - 1] : '');

  const [viewMonth, setViewMonth] = useState(fallbackMonth);

  useEffect(() => {
    if (open) {
      setViewMonth(fallbackMonth);
    }
  }, [open, fallbackMonth]);

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

  const isActive = !!value;
  const triggerLabel = isActive ? formatDayLabel(value) : 'Todos';

  const grid = useMemo(() => {
    if (!viewMonth) return null;
    const [y, m] = viewMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(`${y}-${pad(m)}-${pad(d)}`);
    }
    return { cells, y, m };
  }, [viewMonth]);

  const monthIndex = months.indexOf(viewMonth);
  const canPrev = monthIndex > 0;
  const canNext = monthIndex >= 0 && monthIndex < months.length - 1;

  const handlePrev = () => {
    if (canPrev) setViewMonth(months[monthIndex - 1]);
  };
  const handleNext = () => {
    if (canNext) setViewMonth(months[monthIndex + 1]);
  };

  const handlePick = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  const handleClearDay = () => {
    onChange('');
    setOpen(false);
  };

  const headerLabel = grid
    ? `${MONTH_NAMES[grid.m - 1]} ${grid.y}`
    : 'Sem dados';

  return (
    <div className={styles.pickerWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isActive ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={months.length === 0}
      >
        <span className={styles.triggerLabel}>Dia:</span>
        <span className={styles.triggerValue}>{triggerLabel}</span>
        <span className={styles.caret}>
          <CaretIcon />
        </span>
      </button>

      {open && grid && (
        <div className={`${styles.popover} ${dayStyles.calendar}`} role="dialog">
          <div className={dayStyles.calHeader}>
            <button
              type="button"
              className={dayStyles.navBtn}
              onClick={handlePrev}
              disabled={!canPrev}
              aria-label="Mês anterior"
            >
              <ArrowIcon dir="left" />
            </button>
            <span className={dayStyles.monthLabel}>{headerLabel}</span>
            <button
              type="button"
              className={dayStyles.navBtn}
              onClick={handleNext}
              disabled={!canNext}
              aria-label="Próximo mês"
            >
              <ArrowIcon dir="right" />
            </button>
          </div>

          <div className={dayStyles.dowRow}>
            {DOW_LABELS.map((d, i) => (
              <span key={i} className={dayStyles.dowCell}>
                {d}
              </span>
            ))}
          </div>

          <div className={dayStyles.daysGrid}>
            {grid.cells.map((iso, i) => {
              if (!iso) return <span key={i} className={dayStyles.empty} />;
              const d = Number(iso.slice(8, 10));
              const exists = days.has(iso);
              const selected = value === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`${dayStyles.dayCell} ${
                    exists ? dayStyles.dayExists : dayStyles.dayMuted
                  } ${selected ? dayStyles.daySelected : ''}`}
                  onClick={() => exists && handlePick(iso)}
                  disabled={!exists}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {isActive && (
            <button
              type="button"
              className={dayStyles.clearBtn}
              onClick={handleClearDay}
            >
              Limpar dia
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DayPicker;
