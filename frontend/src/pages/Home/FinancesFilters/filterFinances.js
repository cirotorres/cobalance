export function filterFinances(finances, filters) {
  return finances.filter((f) => {
    if (filters.month && !f.transaction_date.startsWith(filters.month)) {
      return false;
    }
    if (filters.day && f.transaction_date !== filters.day) {
      return false;
    }
    if (filters.participantId === 'none') {
      if (f.participant_id !== null && f.participant_id !== undefined) {
        return false;
      }
    } else if (filters.participantId !== 'all') {
      if (f.participant_id !== filters.participantId) {
        return false;
      }
    }
    return true;
  });
}

export const EMPTY_FILTERS = {
  month: '',
  day: '',
  participantId: 'all',
};

export function isFiltersActive(filters) {
  return (
    filters.month !== '' ||
    filters.day !== '' ||
    filters.participantId !== 'all'
  );
}
