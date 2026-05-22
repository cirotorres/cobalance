import styles from './FinancesFilters.module.css';
import MonthPicker from './MonthPicker';
import DayPicker from './DayPicker';
import ParticipantPicker from './ParticipantPicker';
import { useMonthsAndParticipants } from './useMonthsAndParticipants';
import { EMPTY_FILTERS, isFiltersActive } from './filterFinances';

function FinancesFilters({
  finances,
  participants,
  participantColors,
  value,
  onChange,
}) {
  const { months, days, availableParticipants, hasNullParticipant } =
    useMonthsAndParticipants(finances, participants);

  const setMonth = (month) => onChange({ ...value, month });
  const setDay = (day) => onChange({ ...value, day });
  const setParticipantId = (participantId) =>
    onChange({ ...value, participantId });

  const handleClear = () => onChange(EMPTY_FILTERS);

  const active = isFiltersActive(value);

  return (
    <div className={styles.bar}>
      <MonthPicker months={months} value={value.month} onChange={setMonth} />
      <DayPicker
        days={days}
        months={months}
        value={value.day}
        onChange={setDay}
        monthFilter={value.month}
      />
      <ParticipantPicker
        participants={availableParticipants}
        participantColors={participantColors}
        hasNullParticipant={hasNullParticipant}
        value={value.participantId}
        onChange={setParticipantId}
      />
      {active && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
        >
          Limpar
        </button>
      )}
    </div>
  );
}

export default FinancesFilters;
