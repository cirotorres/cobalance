import { useLayoutEffect, useRef } from 'react';
import { caretForDigits, maskDate } from './entryValidation';
import styles from './Loans.module.css';

/** Máscara exclusiva do cadastro de Empréstimos. */
export default function DateField({ label, value, onChange, required = true }) {
  const input = useRef(null);
  const cursorDigits = useRef(null);

  useLayoutEffect(() => {
    if (cursorDigits.current === null || document.activeElement !== input.current) return;
    const pos = caretForDigits(value, cursorDigits.current);
    input.current.setSelectionRange(pos, pos);
    cursorDigits.current = null;
  }, [value]);

  const update = (raw, digitPosition) => {
    cursorDigits.current = digitPosition;
    onChange(maskDate(raw));
  };

  const onInput = (event) => {
    const e = event.currentTarget;
    const count = (e.value.slice(0, e.selectionStart ?? e.value.length).match(/\d/g) || []).length;
    update(e.value, count);
  };

  const onKeyDown = (event) => {
    const node = event.currentTarget;
    const start = node.selectionStart;
    if (start !== node.selectionEnd) return;
    const previousSlash = event.key === 'Backspace' && start > 0 && value[start - 1] === '/';
    const nextSlash = event.key === 'Delete' && value[start] === '/';
    if (!previousSlash && !nextSlash) return;
    event.preventDefault();
    const digitsBefore = (value.slice(0, start).match(/\d/g) || []).length;
    const allDigits = value.replace(/\D/g, '');
    const deleteAt = previousSlash ? digitsBefore - 1 : digitsBefore;
    update(allDigits.slice(0, deleteAt) + allDigits.slice(deleteAt + 1), deleteAt);
  };

  return (
    <label className={styles.field}>{label}
      <input ref={input} type="text" inputMode="numeric" autoComplete="off"
        placeholder="DD/MM/AAAA" maxLength={10} value={value} onChange={onInput}
        onKeyDown={onKeyDown} required={required} aria-label={label} />
    </label>
  );
}
